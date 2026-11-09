/** Reused from varadatechworks/app-skeleton modules/authorization/simple.mjs, main @2cc6011. */
export const ACTIONS=Object.freeze(['view','create','edit','delete','approve','export','manage']);
export function allowedSimple({roles,roleGrants,resource,action}) {
 if(!ACTIONS.includes(action)||typeof resource!=='string'||!resource)return false;
 return Array.isArray(roles)&&roles.some(r=>Array.isArray(roleGrants?.[r]?.[resource])&&roleGrants[r][resource].includes(action));
}
export function requireSimple(input){if(!allowedSimple(input))throw new Error('Access denied');return true;}
