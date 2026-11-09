import {scryptSync,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {now,newId,audit} from './db.mjs';
import {can} from '../../packages/core/policies.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
export function hashPassword(pass){if(typeof pass!=='string'||pass.length<12||pass.length>200)throw new Error('Password must contain 12–200 characters');const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(pass,salt,64).toString('hex')}`;}
export function verifyPassword(pass,stored){if(typeof pass!=='string'||typeof stored!=='string'||!stored.startsWith('scrypt:'))return false;const [,salt,expected]=stored.split(':');const a=scryptSync(pass,salt,64),b=Buffer.from(expected,'hex');return a.length===b.length&&timingSafeEqual(a,b);}
export function createUser(db,{email,password,displayName,role='CUSTOMER',verified=false}){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||''))||String(displayName||'').trim().length<2)throw new Error('Valid name and email required');
 const id=newId('usr'),e=email.trim().toLowerCase();db.prepare('INSERT INTO users (id,display_name,email,password_hash,role,email_verified,created_at) VALUES (?,?,?,?,?,?,?)').run(id,displayName.trim(),e,hashPassword(password),role,verified?1:0,now());
 audit(db,id,'user.created','user',id,{role});return {id,email:e,displayName:displayName.trim(),role};
}
export function getUser(db,email){return db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').trim().toLowerCase());}
export function makeSession(db,user){const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');
 db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(hash(token),user.id,hash(csrf),new Date(Date.now()+7*86400000).toISOString(),now());
 return {token,csrf,profile:profile(user)};
}
export function sessionFromRequest(db,req){const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dp_session='));if(!cookie)return null;
 const token=cookie.slice('dp_session='.length);if(token.length>200)return null;
 const u=db.prepare('SELECT users.*,sessions.csrf_hash,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?').get(hash(token));
 if(!u||u.expires_at<now()||u.status!=='active')return null;
 const custom=db.prepare('SELECT permissions FROM custom_roles WHERE code=? AND status=?').get(u.role,'active');return {...u,customGrants:custom?JSON.parse(custom.permissions):null,verified:true};
}
export function requireActor(db,req,resource,action,{csrf=true}={}){
 const actor=sessionFromRequest(db,req);if(!actor)throw Object.assign(new Error('Sign in required'),{status:401});
 if(!can(actor,resource,action))throw Object.assign(new Error('You do not have permission for this action'),{status:403});
 if(csrf&&!['GET','HEAD','OPTIONS'].includes(req.method)){const value=String(req.headers['x-csrf-token']||'');if(!value||hash(value)!==actor.csrf_hash)throw Object.assign(new Error('Session security token required'),{status:403});}
 return actor;
}
export function csrfCheck(db,req){const u=sessionFromRequest(db,req);if(!u)throw Object.assign(new Error('Sign in required'),{status:401});if(hash(String(req.headers['x-csrf-token']||''))!==u.csrf_hash)throw Object.assign(new Error('Invalid session security token'),{status:403});return u;}
export function profile(user){return {id:user.id,email:user.email,displayName:user.display_name||user.displayName,role:user.role,emailVerified:!!user.email_verified,organizationId:user.organization_id||null};}
export function clearSession(db,req){const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dp_session='));if(cookie)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(cookie.slice(11)));}
export const sessionCookie=(token,{secure=false}={})=>`dp_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure?'; Secure':''}`;
