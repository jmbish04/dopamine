# Pi Hardware Standards

- **Execution Context:** `mac_provisioner.py` runs on macOS; `app.py` runs on Debian/Raspberry Pi OS. Do not mix their dependencies.
- **SSH Security:** Assume standard key-based or password SSH authentication as configured by the official Raspberry Pi Imager tool.
- **Service Isolation:** The print server must bind to `0.0.0.0:8080` so that the `cloudflared` daemon can route the VPC traffic to it.
