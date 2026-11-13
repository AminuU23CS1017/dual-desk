export function signalResultView(record:any,now=Date.now()){
 if(!record)return {label:'Not tracked',tone:'muted',detail:'No tracked outcome exists for this saved signal.'};
 if(record.delivery!=='sent')return {label:'Not confirmed sent',tone:'amber',detail:`Telegram delivery: ${record.delivery??'unknown'}. No win or loss is assigned.`};
 if(record.status==='target_hit')return {label:'Target hit',tone:'green',detail:'Price reached the reference target before a stop was observed. This is not broker profit.'};
 if(record.status==='stop_hit')return {label:'Stop hit',tone:'red',detail:'Price reached the reference stop before a target was observed. This is not a recorded real-money loss.'};
 if(record.status==='ambiguous')return {label:'Unable to verify',tone:'amber',detail:'Both stop and target were touched within one candle. Their order cannot be determined.'};
 if(record.status==='data_gap')return {label:'Unable to verify',tone:'amber',detail:'Price history is incomplete. This signal is excluded from wins and losses.'};
 if(record.status!=='pending')return {label:'Unknown result',tone:'amber',detail:'No supported outcome was recorded. No win or loss is assigned.'};
 const checked=record.result?.checkedAt;
 if(!checked)return {label:'Awaiting price check',tone:'amber',detail:'No successful outcome check has been recorded yet. The result is unknown.'};
 if(now-checked>90*60000)return {label:'Update overdue',tone:'amber',detail:'The last check is over 90 minutes old. A later target or stop may be unverified.'};
 if(record.result?.cursor&&record.result.cursor*1000<now-120000)return {label:'Catching up history',tone:'amber',detail:'Older candles are being checked in order after a delay. The result is not current yet.'};
 return {label:'Still tracking',tone:'muted',detail:'Neither level was hit in the completed candles checked so far.'};
}
export function signalResultCounts(records:any[]){const sent=records.filter(r=>r.delivery==='sent');const targets=sent.filter(r=>r.status==='target_hit').length,stops=sent.filter(r=>r.status==='stop_hit').length;return {targets,stops,unresolved:sent.length-targets-stops,resolved:targets+stops};}
