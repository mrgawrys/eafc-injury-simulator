import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-player-avatar',
  standalone: true,
  template: `
    @if (avatarUrl() && !imgError()) {
      <img
        [src]="avatarUrl()"
        [alt]="name()"
        loading="lazy"
        referrerpolicy="no-referrer"
        (error)="imgError.set(true)"
        class="rounded-full object-cover bg-muted"
        [class]="sizeClass()"
      />
    } @else {
      <div
        class="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium shrink-0"
        [class]="sizeClass()"
      >
        {{ initials() }}
      </div>
    }
  `,
})
export class PlayerAvatarComponent {
  avatarUrl = input<string | undefined>();
  name = input.required<string>();
  size = input<'sm' | 'lg'>('sm');

  imgError = signal(false);

  sizeClass = computed(() => (this.size() === 'sm' ? 'h-8 w-8 text-xs' : 'h-14 w-14 text-base'));

  initials = computed(() => {
    const parts = this.name().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return this.name().substring(0, 2).toUpperCase();
  });
}
