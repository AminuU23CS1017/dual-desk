#property strict
#property version "1.10"
#property description "Dual Desk account bridge. Demo-only automation. Never places real-account orders."
#include <Trade/Trade.mqh>
input string SiteURL="https://dual-desk-trading.ayomideaminu.chatgpt.site";
input string PairingKey="";
input bool AllowDemoAutomation=false;
input ENUM_TIMEFRAMES SignalTimeframe=PERIOD_M15;
input double RiskPercent=0.5;
input double DailyLossPercent=3.0;
input int MaxOpenPositions=3;
input long MagicNumber=26021001;
CTrade trade;
int ema20=INVALID_HANDLE,ema50=INVALID_HANDLE,atr14=INVALID_HANDLE,adx14=INVALID_HANDLE,rsi14=INVALID_HANDLE;
string bridgeStatus="Monitoring only",dayKey="";
bool remoteEnabled=false;
double dayEquity=0;
string EscapeJSON(string s){StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");StringReplace(s,"\n"," ");StringReplace(s,"\r"," ");StringReplace(s,"\t"," ");return s;}
string Q(string s){return "\""+EscapeJSON(s)+"\"";}
int OnInit(){
 if(PairingKey==""||StringLen(PairingKey)!=43){Print("Enter your Dual Desk pairing key.");return INIT_PARAMETERS_INCORRECT;}
 if(SiteURL!="https://dual-desk-trading.ayomideaminu.chatgpt.site"){Print("Use the official Dual Desk site URL.");return INIT_PARAMETERS_INCORRECT;}
 if(RiskPercent<=0||RiskPercent>0.5||DailyLossPercent<=0||DailyLossPercent>3||MaxOpenPositions<1||MaxOpenPositions>3)return INIT_PARAMETERS_INCORRECT;
 ema20=iMA(_Symbol,SignalTimeframe,20,0,MODE_EMA,PRICE_CLOSE);ema50=iMA(_Symbol,SignalTimeframe,50,0,MODE_EMA,PRICE_CLOSE);
 atr14=iATR(_Symbol,SignalTimeframe,14);adx14=iADX(_Symbol,SignalTimeframe,14);rsi14=iRSI(_Symbol,SignalTimeframe,14,PRICE_CLOSE);
 if(ema20==INVALID_HANDLE||ema50==INVALID_HANDLE||atr14==INVALID_HANDLE||adx14==INVALID_HANDLE||rsi14==INVALID_HANDLE)return INIT_FAILED;
 trade.SetExpertMagicNumber(MagicNumber);trade.SetDeviationInPoints(10);trade.SetTypeFillingBySymbol(_Symbol);EventSetTimer(10);return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){EventKillTimer();IndicatorRelease(ema20);IndicatorRelease(ema50);IndicatorRelease(atr14);IndicatorRelease(adx14);IndicatorRelease(rsi14);Comment("");}
string PositionDetails(){
 string out="[";int count=0;
 for(int i=0;i<PositionsTotal()&&count<50;i++){
  ulong ticket=PositionGetTicket(i);if(ticket==0)continue;
  if(count>0)out+=",";count++;
  out+="{\"ticket\":"+Q((string)ticket)+",\"symbol\":"+Q(PositionGetString(POSITION_SYMBOL))+",\"side\":"+Q(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?"BUY":"SELL")+",\"volume\":"+DoubleToString(PositionGetDouble(POSITION_VOLUME),8)+",\"entry\":"+DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN),10)+",\"current\":"+DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT),10)+",\"stop\":"+DoubleToString(PositionGetDouble(POSITION_SL),10)+",\"target\":"+DoubleToString(PositionGetDouble(POSITION_TP),10)+",\"profit\":"+DoubleToString(PositionGetDouble(POSITION_PROFIT),2)+",\"swap\":"+DoubleToString(PositionGetDouble(POSITION_SWAP),2)+",\"openedAt\":"+(string)(PositionGetInteger(POSITION_TIME)*1000)+",\"comment\":"+Q(StringSubstr(PositionGetString(POSITION_COMMENT),0,120))+"}";
 }
 return out+"]";
}
string DayDeals(bool &complete,string &day){
 MqlDateTime parts;TimeToStruct(TimeCurrent(),parts);parts.hour=0;parts.min=0;parts.sec=0;datetime start=StructToTime(parts);day=StringFormat("%04d-%02d-%02d",parts.year,parts.mon,parts.day);
 complete=HistorySelect(start,TimeCurrent());if(!complete)return "[]";
 string out="[";int count=0,total=HistoryDealsTotal();
 for(int i=total-1;i>=0;i--){ulong ticket=HistoryDealGetTicket(i);if(ticket==0){complete=false;continue;}long type=HistoryDealGetInteger(ticket,DEAL_TYPE);if(type!=DEAL_TYPE_BUY&&type!=DEAL_TYPE_SELL)continue;if(count>=500){complete=false;break;}if(count>0)out+=",";count++;
 long entry=HistoryDealGetInteger(ticket,DEAL_ENTRY);string label=entry==DEAL_ENTRY_IN?"IN":entry==DEAL_ENTRY_OUT?"OUT":entry==DEAL_ENTRY_INOUT?"INOUT":"OUT_BY";
 out+="{\"ticket\":"+Q((string)ticket)+",\"symbol\":"+Q(HistoryDealGetString(ticket,DEAL_SYMBOL))+",\"side\":"+Q(type==DEAL_TYPE_BUY?"BUY":"SELL")+",\"entryType\":"+Q(label)+",\"profit\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_PROFIT),2)+",\"commission\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_COMMISSION),2)+",\"swap\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_SWAP),2)+",\"fee\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_FEE),2)+",\"time\":"+(string)(HistoryDealGetInteger(ticket,DEAL_TIME)*1000)+",\"volume\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_VOLUME),8)+",\"price\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_PRICE),10)+"}";
 }
 return out+"]";
}
bool Heartbeat(){
 string mode="real";long m=AccountInfoInteger(ACCOUNT_TRADE_MODE);if(m==ACCOUNT_TRADE_MODE_DEMO)mode="demo";else if(m==ACCOUNT_TRADE_MODE_CONTEST)mode="contest";
 bool historyComplete=false;string brokerDay="";string deals=DayDeals(historyComplete,brokerDay);string positions=PositionDetails();
 string body="{"+"\"login\":"+Q(IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)))+",\"server\":"+Q(AccountInfoString(ACCOUNT_SERVER))+",\"mode\":"+Q(mode)+",\"currency\":"+Q(AccountInfoString(ACCOUNT_CURRENCY))+",\"balance\":"+DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)+",\"equity\":"+DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)+",\"marginFree\":"+DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE),2)+",\"positions\":"+IntegerToString(PositionsTotal())+",\"symbol\":"+Q(_Symbol)+",\"status\":"+Q(bridgeStatus)+",\"version\":\"1.10\",\"openPositions\":"+positions+",\"positionsComplete\":"+(PositionsTotal()<=50?"true":"false")+",\"brokerDay\":"+Q(brokerDay)+",\"historyComplete\":"+(historyComplete?"true":"false")+",\"deals\":"+deals+"}";
 char payload[],reply[];StringToCharArray(body,payload,0,WHOLE_ARRAY,CP_UTF8);ArrayResize(payload,ArraySize(payload)-1);
 string responseHeaders,headers="Content-Type: application/json\r\nAuthorization: Bearer "+PairingKey+"\r\n";
 ResetLastError();int status=WebRequest("POST",SiteURL+"/api/broker/mt5/heartbeat",headers,5000,payload,reply,responseHeaders);
 remoteEnabled=false;
 if(status!=200){bridgeStatus="Bridge offline or pairing rejected; automation paused";Comment(bridgeStatus,". HTTP ",status," / MT5 ",GetLastError());return false;}
 string answer=CharArrayToString(reply,0,WHOLE_ARRAY,CP_UTF8);remoteEnabled=(answer=="DEMO");return true;
}
bool Value(int handle,int buffer,double &value){double values[1];if(CopyBuffer(handle,buffer,1,1,values)!=1)return false;value=values[0];return MathIsValidNumber(value);}
void TryDemoTrade(){
 // Real-money execution is intentionally impossible in this release.
 if(AccountInfoInteger(ACCOUNT_TRADE_MODE)!=ACCOUNT_TRADE_MODE_DEMO){bridgeStatus="Real/contest account: balance monitoring only";return;}
 if(!AllowDemoAutomation||!remoteEnabled){bridgeStatus="Demo automation paused";return;}
 if(!TerminalInfoInteger(TERMINAL_CONNECTED)||!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)){bridgeStatus="Enable Algo Trading in MT5 to run the demo bot";return;}
 MqlDateTime now;TimeToStruct(TimeCurrent(),now);string currentDay=IntegerToString(now.year)+"-"+IntegerToString(now.mon)+"-"+IntegerToString(now.day);
 string prefix="DD_"+IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))+"_";
 if(dayKey!=currentDay){dayKey=currentDay;string baseline=prefix+"equity_"+dayKey;if(!GlobalVariableCheck(baseline))GlobalVariableSet(baseline,AccountInfoDouble(ACCOUNT_EQUITY));dayEquity=GlobalVariableGet(baseline);}
 double equity=AccountInfoDouble(ACCOUNT_EQUITY),remaining=equity-dayEquity*(1-DailyLossPercent/100.0);
 if(dayEquity<=0||remaining<=0){bridgeStatus="Daily equity loss limit reached";return;}
 if(PositionsTotal()>=MaxOpenPositions||PositionSelect(_Symbol)){bridgeStatus="Position limit reached or symbol already open";return;}
 // Refuse additional risk if an existing account position has no protective stop.
 double existingRisk=0;
 for(int i=0;i<PositionsTotal();i++){ulong ticket=PositionGetTicket(i);if(ticket==0)continue;double sl=PositionGetDouble(POSITION_SL);if(sl<=0){bridgeStatus="Existing position has no stop; new demo entries blocked";return;}string sym=PositionGetString(POSITION_SYMBOL);ENUM_ORDER_TYPE type=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?ORDER_TYPE_BUY:ORDER_TYPE_SELL;MqlTick quote;if(!SymbolInfoTick(sym,quote))return;double loss=0;if(!OrderCalcProfit(type,sym,PositionGetDouble(POSITION_VOLUME),type==ORDER_TYPE_BUY?quote.bid:quote.ask,sl,loss))return;existingRisk+=MathMax(0,-loss);}
 MqlRates bars[];ArraySetAsSeries(bars,true);if(CopyRates(_Symbol,SignalTimeframe,0,65,bars)<65){bridgeStatus="Waiting for at least 65 candles";return;}
 int seconds=PeriodSeconds(SignalTimeframe);if(TimeCurrent()-bars[1].time>seconds*2){bridgeStatus="Market candles are stale";return;}
 string candleKey=prefix+StringSubstr(_Symbol,0,16)+"_"+IntegerToString((int)SignalTimeframe)+"_bar";
 if(GlobalVariableCheck(candleKey)&&GlobalVariableGet(candleKey)>=(double)bars[1].time){bridgeStatus="This candle already processed";return;}
 double fast,slow,atr,adx,rsi;if(!Value(ema20,0,fast)||!Value(ema50,0,slow)||!Value(atr14,0,atr)||!Value(adx14,0,adx)||!Value(rsi14,0,rsi)||atr<=0)return;
 if(adx<20||MathAbs(fast-slow)<atr*.1){bridgeStatus="Waiting for trend strength";return;}
 double high=bars[2].high,low=bars[2].low;for(int i=3;i<=21;i++){high=MathMax(high,bars[i].high);low=MathMin(low,bars[i].low);}
 bool buy=fast>slow&&bars[1].close>high&&rsi>=50&&rsi<=75,sell=fast<slow&&bars[1].close<low&&rsi>=25&&rsi<=50;
 if(!buy&&!sell){bridgeStatus="Waiting for completed breakout";return;}
 MqlTick tick;if(!SymbolInfoTick(_Symbol,tick)||TimeCurrent()-tick.time>30){bridgeStatus="Waiting for fresh broker quote";return;}
 double entry=buy?tick.ask:tick.bid;if(MathAbs(entry-bars[1].close)>.5*atr){bridgeStatus="Entry moved too far from breakout";return;}
 double distance=1.5*atr,point=SymbolInfoDouble(_Symbol,SYMBOL_POINT),tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(tickSize<=0||distance<(SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)+2)*point){bridgeStatus="Stop distance unsupported by broker";return;}
 double stop=MathRound((buy?entry-distance:entry+distance)/tickSize)*tickSize,target=MathRound((buy?entry+2*distance:entry-2*distance)/tickSize)*tickSize;
 if(stop<=0||target<=0)return;
 ENUM_ORDER_TYPE orderType=buy?ORDER_TYPE_BUY:ORDER_TYPE_SELL;double lossPerLot=0;if(!OrderCalcProfit(orderType,_Symbol,1.0,entry,stop,lossPerLot)||lossPerLot>=0)return;
 double budget=MathMin(equity*RiskPercent/100.0,MathMax(0,remaining-existingRisk))*.9;
 double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP),minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),maxLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);if(step<=0)return;
 double lots=NormalizeDouble(MathFloor(MathMin(maxLot,budget/MathAbs(lossPerLot))/step)*step,8);
 if(lots<minLot||lots<=0){bridgeStatus="Minimum lot exceeds available demo risk budget";return;}
 double margin=0;if(!OrderCalcMargin(orderType,_Symbol,lots,entry,margin)||margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)*.9){bridgeStatus="Insufficient demo margin";return;}
 // Mark before submission: never automatically retry an ambiguous or failed order.
 GlobalVariableSet(candleKey,(double)bars[1].time);GlobalVariablesFlush();
 bool sent=buy?trade.Buy(lots,_Symbol,0,stop,target,"DualDesk demo"):trade.Sell(lots,_Symbol,0,stop,target,"DualDesk demo");
 uint code=trade.ResultRetcode();if(sent&&(code==TRADE_RETCODE_DONE||code==TRADE_RETCODE_DONE_PARTIAL||code==TRADE_RETCODE_PLACED))bridgeStatus="Demo order submitted; broker stop and target attached";else bridgeStatus="Demo order not confirmed: "+IntegerToString(code)+". Check MT5 history; no automatic retry";
}
void OnTimer(){if(!Heartbeat())return;TryDemoTrade();Comment("Dual Desk: ",bridgeStatus,"\nSymbol: ",_Symbol," | ",EnumToString(SignalTimeframe),"\nReal account orders are disabled.");}
