import { TemplateRegistry } from "./TemplateRegistry";
import { TheAnh28BannerTemplate } from "./theanh28/TheAnh28BannerTemplate";
import { TheAnh28Template } from "./theanh28/TheAnh28Template";

/** Thứ tự = thứ tự trong ô "Phong cách video"; mục đầu là mặc định. */
export function defaultTemplateRegistry(): TemplateRegistry {
  return new TemplateRegistry([new TheAnh28Template(), new TheAnh28BannerTemplate()]);
}
