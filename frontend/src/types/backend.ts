export interface UserStats {
  // volunteer / user metrics
  ticketsCreated?: number;
  ticketsResolved?: number;
  ticketsThisMonth?: number;
  timeSpent?: number; // hours or minutes depending on backend (frontend multiplies by 60 in some places)
  peopleHelped?: number;
  certificates?: number;
  certificatesIssued?: number; // alias if backend uses different name
  resolvedRate?: number; // fraction 0..1
}

export interface PlatformStats {
  volunteers?: number;
  peopleHelped?: number;
  hoursSpent?: number;
  totalUsers?: number;
  totalVolunteers?: number;
  totalTickets?: number;
  resolvedTickets?: number;
  totalHoursVolunteered?: number;
}
