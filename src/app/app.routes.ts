import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./pages/team-selection/team-selection").then(
        (m) => m.TeamSelectionComponent
      ),
  },
  {
    path: "dashboard",
    loadComponent: () =>
      import("./pages/dashboard/dashboard").then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: "injury-log",
    loadComponent: () =>
      import("./pages/injury-log/injury-log").then(
        (m) => m.InjuryLogComponent
      ),
  },
];
