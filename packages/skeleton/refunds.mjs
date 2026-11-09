/** Reused from varadatechworks/app-skeleton modules/payments/refunds.mjs, main @2cc6011. */
function nonNegative(n,name){if(!Number.isSafeInteger(n)||n<0)throw new Error(`Invalid ${name}`);return n;}
export function remainingRefundableMinor({capturedMinor,settledRefundsMinor=0,pendingRefundsMinor=0}){
 nonNegative(capturedMinor,'captured amount');nonNegative(settledRefundsMinor,'settled refunds');nonNegative(pendingRefundsMinor,'pending refunds');
 const remaining=capturedMinor-settledRefundsMinor-pendingRefundsMinor;
 if(remaining<0)throw new Error('Refund ledger exceeds captured amount');return remaining;
}
export function planRefund({capturedMinor,settledRefundsMinor=0,pendingRefundsMinor=0,requestedMinor,feeDeductionMinor=0,reason,actorId}){
 const available=remainingRefundableMinor({capturedMinor,settledRefundsMinor,pendingRefundsMinor});nonNegative(requestedMinor,'requested refund');nonNegative(feeDeductionMinor,'deduction');
 if(requestedMinor===0||requestedMinor>available||feeDeductionMinor>requestedMinor)throw new Error('Refund exceeds refundable amount or has invalid deduction');
 if(typeof reason!=='string'||reason.trim().length<5||typeof actorId!=='string'||!actorId.trim())throw new Error('Refund reason and authorized actor required');
 return Object.freeze({requestedMinor,feeDeductionMinor,providerRefundMinor:requestedMinor-feeDeductionMinor,reason:reason.trim(),actorId});
}
export function nextRefundState(current,next){const t={requested:['approved','rejected'],approved:['submitted','rejected'],submitted:['succeeded','failed'],failed:['approved'],succeeded:[],rejected:[]};if(!t[current]?.includes(next))throw new Error('Invalid refund transition');return next;}
