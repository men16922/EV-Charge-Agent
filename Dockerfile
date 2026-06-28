FROM us-central1-docker.pkg.dev/database-toolbox/toolbox/toolbox:latest

# Copy tools.yaml config into the image
COPY tools.yaml /etc/toolbox/tools.yaml

# Expose port 8080 (default for Cloud Run)
EXPOSE 8080

# Toolbox defaults to 127.0.0.1:5000 and looks for ./tools.yaml.
# Cloud Run requires listening on 0.0.0.0:$PORT (8080) and we point at the
# explicit config path baked into the image.
CMD ["--tools-file", "/etc/toolbox/tools.yaml", "--address", "0.0.0.0", "--port", "8080"]
