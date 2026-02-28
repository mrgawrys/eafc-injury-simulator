import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { StorageService } from "../../services/storage";
import type { Injury } from "../../models/injury";

@Component({
  selector: "app-injury-log",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./injury-log.html",
})
export class InjuryLogComponent implements OnInit {
  private storageService = inject(StorageService);
  private router = inject(Router);

  injuries = signal<Injury[]>([]);
  teamName = signal("");

  sortedInjuries = computed(() =>
    [...this.injuries()].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
  );

  ngOnInit() {
    const state = this.storageService.getGameState();
    if (!state) {
      this.router.navigate(["/"]);
      return;
    }
    this.teamName.set(state.teamName);
    this.injuries.set(state.injuryHistory);
  }
}
