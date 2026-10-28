#!/usr/bin/env python3
"""Migrate issues from YouTrack to GitHub (issues + GitHub Projects v2).

Usage (env vars):
  YOUTRACK_URL=https://youtrack.example.com
  YOUTRACK_TOKEN=perm-...
  YOUTRACK_PROJECT=SP          # project key
  GITHUB_TOKEN=ghp_...
  GITHUB_OWNER=org-or-user
  GITHUB_REPO=repo
  GITHUB_PROJECT_NUMBER=1      # Projects v2 number (optional; if omitted, issues only)

Optional:
  USER_MAP='{"yt_login": "github_login"}'   # JSON
  STATUS_FIELD_MAP='{"Open":"Todo","In Progress":"In Progress","Fixed":"Done"}'
  PRIORITY_FIELD=Priority
  TYPE_FIELD=Type
  MAX_ISSUES=0   # 0 = all

Notes:
  - Uses GitHub's *unofficial* Issue Import API to preserve created_at/updated_at/closed_at.
  - All imported issues/comments are authored by the GITHUB_TOKEN owner (API limitation).
  - Attachments and issue links are NOT migrated by this script (see README).
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

YT_URL = os.environ["YOUTRACK_URL"].rstrip("/")
YT_TOKEN = os.environ["YOUTRACK_TOKEN"]
YT_PROJECT = os.environ["YOUTRACK_PROJECT"]
GH_TOKEN = os.environ["GITHUB_TOKEN"]
GH_OWNER = os.environ["GITHUB_OWNER"]
GH_REPO = os.environ["GITHUB_REPO"]
GH_PROJECT_NUMBER = os.environ.get("GITHUB_PROJECT_NUMBER")
USER_MAP = json.loads(os.environ.get("USER_MAP", "{}"))
STATUS_MAP = json.loads(os.environ.get("STATUS_FIELD_MAP", '{"Open":"Todo","In Progress":"In Progress","Fixed":"Done","Verified":"Done","Closed":"Done"}'))
PRIORITY_FIELD = os.environ.get("PRIORITY_FIELD", "Priority")
TYPE_FIELD = os.environ.get("TYPE_FIELD", "Type")
MAX_ISSUES = int(os.environ.get("MAX_ISSUES", "0"))

YT_HEADERS = {"Authorization": f"Bearer {YT_TOKEN}", "Accept": "application/json"}
GH_HEADERS = {
    "Authorization": f"Bearer {GH_TOKEN}",
    "Accept": "application/vnd.github.golden-comet-preview+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}


def http(method, url, headers=None, data=None, timeout=60):
    req = urllib.request.Request(url, method=method, headers=headers or {})
    if data is not None:
        body = json.dumps(data).encode()
        req.data = body
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw.decode("utf-8", "replace")
        return e.code, parsed


def yt_get(path, params=None):
    url = YT_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    code, body = http("GET", url, headers=YT_HEADERS)
    if code >= 400:
        raise RuntimeError(f"YouTrack GET {path} -> {code}: {body}")
    return body


def gh_rest(method, path, data=None):
    url = "https://api.github.com" + path
    code, body = http(method, url, headers=GH_HEADERS, data=data)
    if code >= 400:
        raise RuntimeError(f"GitHub {method} {path} -> {code}: {body}")
    return code, body


def gh_graphql(query, variables=None):
    code, body = http("POST", "https://api.github.com/graphql", headers={
        "Authorization": f"Bearer {GH_TOKEN}",
        "Content-Type": "application/json",
    }, data={"query": query, "variables": variables or {}})
    if code >= 400 or (isinstance(body, dict) and body.get("errors")):
        raise RuntimeError(f"GraphQL -> {code}: {body}")
    return body["data"]


def iso_ms(ts_ms):
    if ts_ms is None:
        return None
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_youtrack_issues():
    fields = "id,idReadable,summary,description,created,updated,resolved,reporter(login,name),tags(name),customFields(name,value(name)),links(id,direction,linkType(name),issues(id,idReadable))"
    issues = []
    skip = 0
    top = 100
    while True:
        batch = yt_get("/api/issues", {
            "query": f"project: {YT_PROJECT}",
            "fields": fields,
            "customFields": [PRIORITY_FIELD, TYPE_FIELD, "State", "Assignee"],
            "$top": top,
            "$skip": skip,
        })
        if not batch:
            break
        issues.extend(batch)
        print(f"Fetched {len(issues)} issues...", file=sys.stderr)
        if MAX_ISSUES and len(issues) >= MAX_ISSUES:
            issues = issues[:MAX_ISSUES]
            break
        if len(batch) < top:
            break
        skip += top
    return issues


def fetch_comments(issue_id):
    body = yt_get(f"/api/issues/{issue_id}/comments", {
        "fields": "id,text,author(login,name),created,updated",
        "$top": 100,
    })
    return body or []


def cf(issue, name):
    for c in issue.get("customFields") or []:
        if c.get("name") == name:
            v = c.get("value")
            if isinstance(v, dict):
                return v.get("name") or v.get("login")
            if isinstance(v, list):
                return [x.get("name") if isinstance(x, dict) else x for x in v]
            return v
    return None


def map_user(yt_login):
    if not yt_login:
        return None
    return USER_MAP.get(yt_login, yt_login)


def ensure_labels(tags):
    # create labels from YouTrack tags (best-effort)
    for t in tags:
        name = t.get("name") if isinstance(t, dict) else str(t)
        if not name:
            continue
        code, _ = gh_rest("POST", f"/repos/{GH_OWNER}/{GH_REPO}/labels", {
            "name": name, "color": "ededed",
        })
        if code not in (201, 422):
            print(f"Label create {name}: {code}", file=sys.stderr)


def import_issue(yt_issue):
    comments = fetch_comments(yt_issue["id"])
    labels = [t["name"] for t in (yt_issue.get("tags") or []) if isinstance(t, dict)]
    # add type/priority as labels too
    t = cf(yt_issue, TYPE_FIELD)
    if t:
        labels.append(str(t))
    p = cf(yt_issue, PRIORITY_FIELD)
    if p:
        labels.append(str(p))

    state = cf(yt_issue, "State") or "Open"
    closed = state.lower() in ("fixed", "verified", "closed", "done", "resolved")

    issue_payload = {
        "title": yt_issue.get("summary") or "(no title)",
        "body": yt_issue.get("description") or "",
        "created_at": iso_ms(yt_issue.get("created")),
        "updated_at": iso_ms(yt_issue.get("updated")),
        "closed": closed,
        "labels": labels,
    }
    if closed and yt_issue.get("resolved"):
        issue_payload["closed_at"] = iso_ms(yt_issue["resolved"])
    assignee = map_user(cf(yt_issue, "Assignee"))
    if assignee:
        issue_payload["assignee"] = assignee

    comment_payloads = []
    for c in comments:
        cp = {"body": c.get("text") or ""}
        ca = iso_ms(c.get("created"))
        if ca:
            cp["created_at"] = ca
        comment_payloads.append(cp)

    payload = {"issue": issue_payload}
    if comment_payloads:
        payload["comments"] = comment_payloads

    code, resp = gh_rest("POST", f"/repos/{GH_OWNER}/{GH_REPO}/import/issues", payload)
    import_url = resp["url"]
    # poll
    for _ in range(60):
        time.sleep(2)
        code, st = gh_rest("GET", import_url.replace("https://api.github.com", ""))
        if st.get("status") in ("imported", "failed"):
            if st.get("status") == "failed":
                print(f"IMPORT FAILED {yt_issue['idReadable']}: {st.get('errors')}", file=sys.stderr)
            return st
    raise RuntimeError(f"Timeout importing {yt_issue['idReadable']}")


def get_project_node_id():
    if not GH_PROJECT_NUMBER:
        return None
    data = gh_graphql("""
      query($owner:String!,$number:Int!){
        user(login:$owner){ projectV2(number:$number){ id } }
        organization(login:$owner){ projectV2(number:$number){ id } }
      }""", {"owner": GH_OWNER, "number": int(GH_PROJECT_NUMBER)})
    node = None
    if data.get("user") and data["user"].get("projectV2"):
        node = data["user"]["projectV2"]["id"]
    elif data.get("organization") and data["organization"].get("projectV2"):
        node = data["organization"]["projectV2"]["id"]
    if not node:
        raise RuntimeError("Project not found")
    return node


def get_project_fields(project_id):
    data = gh_graphql("""
      query($id:ID!){
        node(id:$id){
          ... on ProjectV2 {
            fields(first:50){
              nodes{
                ... on ProjectV2Field { id name }
                ... on ProjectV2SingleSelectField { id name options { id name } }
                ... on ProjectV2IterationField { id name }
              }
            }
          }
        }
      }""", {"id": project_id})
    fields = {}
    for f in data["node"]["fields"]["nodes"]:
        fields[f["name"]] = f
    return fields


def add_to_project(project_id, issue_node_id):
    data = gh_graphql("""
      mutation($project:ID!,$content:ID!){
        addProjectV2ItemById(input:{projectId:$project,contentId:$content}){
          item { id }
        }
      }""", {"project": project_id, "content": issue_node_id})
    return data["addProjectV2ItemById"]["item"]["id"]


def set_project_field(project_id, item_id, field, value):
    if field is None:
        return
    if "options" in field:
        # single select: find option by name
        opt = None
        for o in field["options"]:
            if o["name"].lower() == str(value).lower():
                opt = o["id"]
                break
        if not opt:
            # try status map
            mapped = STATUS_MAP.get(str(value), value)
            for o in field["options"]:
                if o["name"].lower() == str(mapped).lower():
                    opt = o["id"]
                    break
        if not opt:
            return
        gh_graphql("""
          mutation($project:ID!,$item:ID!,$field:ID!,$opt:String!){
            updateProjectV2ItemFieldValue(input:{
              projectId:$project,itemId:$item,fieldId:$field,
              value:{singleSelectOptionId:$opt}
            }){ projectV2Item { id } }
          }""", {"project": project_id, "item": item_id, "field": field["id"], "opt": opt})
    else:
        # text/number/date not handled generically
        pass


def main():
    issues = fetch_youtrack_issues()
    print(f"Total issues: {len(issues)}", file=sys.stderr)

    # collect tags
    all_tags = set()
    for it in issues:
        for t in it.get("tags") or []:
            if isinstance(t, dict) and t.get("name"):
                all_tags.add(t["name"])
    ensure_labels([{"name": t} for t in all_tags])

    project_id = get_project_node_id()
    project_fields = get_project_fields(project_id) if project_id else {}
    status_field = project_fields.get("Status")
    priority_field = project_fields.get("Priority")
    type_field = project_fields.get("Type")

    for idx, yi in enumerate(issues, 1):
        print(f"[{idx}/{len(issues)}] {yi['idReadable']} ...", file=sys.stderr)
        st = import_issue(yi)
        issue_url = st.get("issue_url")
        issue_node_id = None
        if issue_url:
            # fetch node_id
            code, gh_issue = gh_rest("GET", issue_url.replace("https://api.github.com", ""))
            issue_node_id = gh_issue.get("node_id")
        # status field from YouTrack State
        yt_state = cf(yi, "State") or "Open"
        if project_id and issue_node_id:
            item_id = add_to_project(project_id, issue_node_id)
            set_project_field(project_id, item_id, status_field, STATUS_MAP.get(yt_state, yt_state))
            p = cf(yi, PRIORITY_FIELD)
            if p and priority_field:
                set_project_field(project_id, item_id, priority_field, p)
            t = cf(yi, TYPE_FIELD)
            if t and type_field:
                set_project_field(project_id, item_id, type_field, t)
        time.sleep(0.5)  # be nice

    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()
