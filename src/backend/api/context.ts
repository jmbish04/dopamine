export const getContextPayload = () => ({
  name: "Dopamine",
  version: "1.0.0",
  description:
    "ADHD-aware task tracker with receipt printing, scan-to-resume workflows, and Shadcn dark theme surfaces.",
  docs: {
    openapi: "/openapi.json",
    swagger: "/swagger",
    scalar: "/scalar",
  },
  hardware: {
    printerBinding: "PRINTER_VPC",
    receiptFormat: "6-character task id plus QR code",
    scannerMode: "keyboard wedge",
  },
});
