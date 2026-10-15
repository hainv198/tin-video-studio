export class RenderCancelledError extends Error {
  constructor() {
    super("Đã huỷ dựng video");
    this.name = "RenderCancelledError";
  }
}
