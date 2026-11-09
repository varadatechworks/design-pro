/** Reused from varadatechworks/app-skeleton modules/workflow/index.mjs, main @2cc6011. */
export function createWorkflow({initial,transitions}) {
 if (!initial || !transitions || typeof transitions !== 'object') throw new Error('Workflow definition required');
 const statuses = new Set([initial,...Object.keys(transitions),...Object.values(transitions).flatMap(x=>Array.isArray(x)?x:[])]);
 return Object.freeze({initial,transitions:structuredClone(transitions),statuses:[...statuses]});
}
export function transition(workflow,current,next,{actorId,reason,allowed=false}={}) {
 if (!actorId||!allowed)throw new Error('Transition not authorized');
 if (!workflow?.transitions?.[current]?.includes(next))throw new Error('Invalid status transition');
 return {from:current,to:next,actorId,reason:String(reason??'').trim(),at:new Date().toISOString()};
}
