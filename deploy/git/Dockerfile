# In-stack git storage for the spec registry (compose profile `git`).
# A bare repo + git daemon; git:// is reachable only inside the compose
# network (the port is never published), receive-pack enabled for the
# service bot's pushes.
FROM alpine:3.21

RUN apk add --no-cache git git-daemon \
  && mkdir -p /srv/git \
  && chown -R nobody:nogroup /srv/git \
  # Single-purpose container as non-root; mounted volume data is the only
  # content it ever touches, so the dubious-ownership check is disabled.
  && git config --system --add safe.directory '*'

USER nobody
EXPOSE 9418

CMD mkdir -p /srv/git \
  && (test -f /srv/git/specs.git/HEAD || git init --bare --initial-branch=main /srv/git/specs.git) \
  && exec git daemon --base-path=/srv/git --export-all --enable=receive-pack --reuseaddr
