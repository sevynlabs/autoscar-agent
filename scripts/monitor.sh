#!/bin/bash
# Monitor autoscar health and auto-fix network issues

HEALTH_URL="https://autoscar.soft7ai.com/api/health"
NETWORK_NAME="gkogk0gos4oc4ogcwwsscwc8_autoscar-net"
LOG_FILE="/var/log/autoscar-monitor.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$HEALTH_URL" 2>/dev/null)
    echo "$response"
}

fix_network() {
    log "Fixing network connection..."
    docker network connect "$NETWORK_NAME" coolify-proxy 2>/dev/null
    docker restart coolify-proxy >> "$LOG_FILE" 2>&1
    log "Proxy restarted"
}

# Main loop
while true; do
    status=$(check_health)

    if [ "$status" != "200" ]; then
        log "Health check FAILED (status: $status) - attempting fix"
        fix_network
        sleep 30

        # Check again
        status=$(check_health)
        if [ "$status" = "200" ]; then
            log "Health check RECOVERED"
        else
            log "Health check still failing after fix (status: $status)"
        fi
    fi

    # Check every 2 minutes
    sleep 120
done
