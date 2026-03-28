export class Animation {
  current: number;
  target: number;
  progress: number;
  time: number;
  start: number;

  constructor(options: Partial<Pick<Animation, "current" | "target" | "progress" | "time">>) {
    const resolvedOptions = Object.assign(
      {
        current: 0,
        target: 0,
        progress: 0,
        time: 1,
      },
      options
    );

    this.current = resolvedOptions.current;
    this.target = resolvedOptions.target;
    this.progress = resolvedOptions.progress;
    this.time = resolvedOptions.time;
    this.start = this.current;
  }

  goTo(target: number, time: number): void {
    if (time <= 1) {
      this.current = target;
    }

    this.target = target;
    this.time = time;
    this.progress = 0;
    this.start = this.current;
  }

  animate(elapsed: number): boolean {
    if (this.progress >= 1 || isNaN(this.progress) || this.time <= 1) {
      this.current = this.target;
      return false;
    }

    const target = this.target;
    let progress = this.progress;
    const time = this.time;
    const start = this.start;
    progress += elapsed / time;
    progress = Math.min(progress, 1);
    this.current = start * (1.0 - progress) + target * progress;
    this.progress = progress;

    return true;
  }

  cancelAnimation(): void {
    this.target = this.current;
    this.progress = 1;
  }
}
