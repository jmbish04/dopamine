---
description: Implement Hardware Bridge
---

# Actionable hardware bridge implementation

## Objective

Create the `/raspberrypi` hardware bridge module, including the print server code and a macOS-based automated provisioning script for zero-touch hardware setup.

## Execution Steps

1. **Create Directory:** Scaffold the `/raspberrypi` folder at the root of the project.
2. **Implement Print Server:**
   - Write `app.py` utilizing `Flask` and `python-escpos`.
   - Ensure the printer uses vendor ID `04b8` and product ID `0e28`, and the ESC/POS QR code is generated with `native=True` for optimal scanning by the Tera D5100.
3. **System Configuration Files:**
   - Generate `onion-printer.service` for systemd daemonization.
   - Generate `99-escpos.rules` to bypass root privileges for USB access.
4. **Mac Provisioning Automation:**
   - Write `mac_provisioner.py`. Use the standard library `subprocess` module to execute `scp` and `ssh` commands directly from the Mac terminal to the Pi, avoiding the need for complex Python SSH libraries.
   - The script must transfer the 3 files, run `apt-get` installs, configure `pip` packages, place the `udev` and `systemd` files in the correct Linux directories, and start the service.
5. **Documentation:**
   - Write `README.md` with explicit instructions on flashing the SD card via Raspberry Pi Imager (pre-configuring Wi-Fi and SSH), running the provisioner script, and routing the Cloudflare VPC Tunnel to localhost port 8080.
