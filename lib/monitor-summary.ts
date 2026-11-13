export function monitorSummary(d:any,now=Date.now()){
 if(!d.enabled)return {title:'Automatic alerts paused',detail:'Resume alerts in Accounts & bots to allow scheduled delivery.',tone:'amber'};
 if(!d.lastScan)return {title:'No scan recorded yet',detail:'Alerts are enabled, but no completed scan has been recorded.',tone:'amber'};
 if(now-d.lastScan>90*60000)return {title:'Scheduled check overdue',detail:'No recent scan is recorded. Check the cloud schedule; an enabled switch does not prove it ran.',tone:'amber'};
 const r=d.lastResult;
 if(r?.state==='running')return {title:'Scan has not finished',detail:'Wait for its result. No market coverage is confirmed by a running scan.',tone:'amber'};
 if(!r?.checked)return {title:'Market data unavailable',detail:'The latest scan checked no markets successfully. No new setups could be verified.',tone:'red'};
 if(r.state==='partial'||r.errors?.length)return {title:'Some checks failed',detail:`${r.checked} market/timeframe checks succeeded; ${r.sent??0} new alerts were sent. Review the failed checks below.`,tone:'amber'};
 return {title:'Latest scan completed',detail:`${r.checked} market/timeframe checks succeeded; ${r.sent??0} new alerts were sent. There is no guaranteed daily number.`,tone:'green'};
}
