export interface UserStats {
  totalTimeSpent: number;
  ticketsCreated: number;
  ticketsResolved: number;
  peopleHelped: number;
  certificatesIssued: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalVolunteers: number;
  totalTickets: number;
  resolvedTickets: number;
  totalHoursVolunteered: number;
}
