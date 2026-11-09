import {createWorkflow,transition} from '../skeleton/workflow.mjs';
import {allowedSimple} from '../skeleton/authorization.mjs';
const every=['view','create','edit','delete','approve','export','manage'];
export const DEFAULT_GRANTS={
 SUPER_ADMIN:Object.fromEntries(['users','roles','catalog','pricing','quotes','orders','proofs','production','inventory','shipping','payments','refunds','reports','audit','settings','tickets'].map(k=>[k,every])),
 BUSINESS_ADMIN:{catalog:['view','edit','create'],pricing:['view'],quotes:['view','create','edit','approve'],orders:['view','edit'],proofs:['view'],production:['view'],inventory:['view'],shipping:['view'],reports:['view'],users:['view'],tickets:['view','edit']},
 SALES:{catalog:['view'],quotes:['view','create','edit'],orders:['view'],proofs:['view'],reports:['view']},
 ESTIMATOR:{catalog:['view'],pricing:['view'],quotes:['view','edit','approve'],proofs:['view'],production:['view']},
 DESIGNER:{proofs:['view','create','edit'],orders:['view'],production:['view']},
 PLANNER:{orders:['view'],proofs:['view'],production:['view','create','edit','approve'],inventory:['view']},
 OPERATOR:{production:['view','edit'],orders:['view']},
 QC:{production:['view','edit','approve'],proofs:['view']},
 STORES:{inventory:['view','create','edit'],production:['view']},
 DISPATCH:{orders:['view'],shipping:['view','create','edit'],production:['view']},
 FINANCE:{payments:['view','edit'],refunds:['view','create','approve'],orders:['view'],reports:['view']},
 SUPPORT:{orders:['view'],quotes:['view'],refunds:['view','create'],shipping:['view'],tickets:['view','create','edit']},
 CUSTOMER:{catalog:['view'],quotes:['view','create'],orders:['view','create'],proofs:['view','approve'],shipping:['view'],payments:['view','create'],refunds:['view','create'],tickets:['view','create']}
};
export const FLOWS={
 quote:createWorkflow({initial:'indicative',transitions:{indicative:['technical_review','firm','expired'],technical_review:['firm','rejected','expired'],firm:['accepted','expired','superseded'],accepted:[],expired:[],rejected:[],superseded:[]}}),
 order:createWorkflow({initial:'pending_payment',transitions:{pending_payment:['pending_proof','cancelled'],pending_proof:['production_ready','cancelled'],production_ready:['in_production','cancelled'],in_production:['quality_check','on_hold'],on_hold:['in_production','cancelled'],quality_check:['ready_to_ship','rework'],rework:['in_production'],ready_to_ship:['shipped'],shipped:['delivered','delivery_exception'],delivery_exception:['shipped','returned'],delivered:['closed','claim_open'],claim_open:['closed','returned'],returned:['closed'],closed:[],cancelled:[]}}),
 proof:createWorkflow({initial:'draft',transitions:{draft:['customer_pending'],customer_pending:['approved','rejected','superseded'],rejected:['draft'],approved:['superseded'],superseded:[]}}),
 shipment:createWorkflow({initial:'prepared',transitions:{prepared:['labelled','cancelled'],labelled:['collected'],collected:['in_transit'],in_transit:['delivered','exception'],exception:['in_transit','rto','lost'],delivered:[],rto:[],lost:[],cancelled:[]}})
};
export function can(actor,resource,action){if(!actor?.verified||!actor?.role)return false;return allowedSimple({roles:[actor.role],roleGrants:actor.customGrants?{...DEFAULT_GRANTS,[actor.role]:actor.customGrants}:DEFAULT_GRANTS,resource,action});}
export function changeState(flow,current,next,actor,reason){return transition(FLOWS[flow],current,next,{actorId:actor?.id,reason,allowed:can(actor,flow==='quote'?'quotes':flow==='order'?'orders':flow==='shipment'?'shipping':'proofs',flow==='quote'?'approve':flow==='proof'?'approve':'edit')});}
