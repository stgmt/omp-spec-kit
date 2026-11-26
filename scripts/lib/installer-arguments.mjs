/**
 * The one owner of the registry-target argv triple shared by every installer
 * (host repair and demo-stack guard installs). Changing a flag is one edit.
 */
export function installerArguments(host, { url, project, workspace }) {
  return [
    ...(host === null ? [] : ["--host", host]),
    "--url", url, "--project", project, "--workspace", workspace,
  ];
}
