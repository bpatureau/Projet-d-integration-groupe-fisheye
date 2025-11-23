FROM eclipse-mosquitto:2

# Install openssl for certificate generation
RUN apk add --no-cache openssl

# Copy custom configuration file
COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf

# Copy entrypoint script
COPY entrypoint.sh /usr/bin/entrypoint.sh

# Ensure the script is executable
RUN chmod +x /usr/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]

# Default command
CMD ["/usr/sbin/mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]
