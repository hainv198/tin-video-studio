import { TemplateRegistry } from "./TemplateRegistry";
import { TheAnh28Template } from "./theanh28/TheAnh28Template";

export function defaultTemplateRegistry(): TemplateRegistry {
  return new TemplateRegistry([new TheAnh28Template()]);
}
