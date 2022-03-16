export const v = {
  pcWidth: 1366,
  spWidth: 750,
  breakPoint: 757,
}

export class f {
  static vw(arg: number, device: number = v.pcWidth): string {
    return `${(arg / device) * 100}vw`;
  }

  static pc(): string {
    return `@media (min-width: ${v.breakPoint + 1}px)`;
  }

  static sp(): string {
    return `@media (max-width: ${v.breakPoint}px)`;
  }

}

