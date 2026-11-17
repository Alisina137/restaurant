export type DashboardPeriod=7|30;
export type DashboardLive={
 activeTables:number;unpaidChecks:number;ordersToday:number;
 newTickets:number;preparingTickets:number;readyTickets:number;
 pendingGuestApprovals:number;pendingServiceRequests:number;
};
export type DashboardPerformance={
 settledChecks:number;netSalesMinor:number;netCollectedMinor:number;refundedMinor:number;
};
export type DashboardDay={
 date:string;netCollectedMinor:number;netSalesMinor:number;settledChecks:number;refundsMinor:number;
};
export type DashboardReport={
 generatedAt:string;
 period:{days:DashboardPeriod;from:string;to:string;previousFrom:string;previousTo:string;
  timezone:string;currency:"AFN";businessDate:string};
 live:DashboardLive;
 performance:{
  current:DashboardPerformance&{grossSalesMinor:number;paidMinor:number;tenders:number;cashMinor:number;transferMinor:number};
  previous:DashboardPerformance;
  daily:DashboardDay[];
 };
 topItems:Array<{itemId:string;nameFa:string;namePs:string;nameEn:string;quantity:number;netMinor:number}>;
 service:{tickets:number;prepared:number;served:number;prepMedianSeconds:number|null;prepP95Seconds:number|null;
  cancelledItems:number;cancelRatePercent:number|null};
 accountingNote:string;
};
export function percentageChange(current:number,previous:number):number|null{
 if(!Number.isSafeInteger(current)||!Number.isSafeInteger(previous)||previous===0)return null;
 return Math.round((current-previous)/Math.abs(previous)*1000)/10;
}
export function dashboardHasCollection(data:DashboardDay[]):boolean{
 return data.some(day=>day.netCollectedMinor!==0);
}
