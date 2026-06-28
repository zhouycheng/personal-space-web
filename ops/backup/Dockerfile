FROM alpine:3.21

RUN apk add --no-cache bash coreutils restic sqlite tzdata

COPY ops/backup/backup.sh /opt/backup/backup.sh
COPY ops/backup/check.sh /opt/backup/check.sh
COPY ops/backup/restore.sh /opt/backup/restore.sh
COPY ops/backup/health.sh /opt/backup/health.sh
COPY ops/backup/entrypoint.sh /opt/backup/entrypoint.sh

RUN chmod +x /opt/backup/*.sh

ENTRYPOINT ["/opt/backup/entrypoint.sh"]
