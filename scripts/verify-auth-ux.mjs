import {strict as assert} from "node:assert";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const server=read("apps/api/src/auth.ts");
for(const term of ["sendResetPassword","resetPasswordTokenExpiresIn: 3600","requireEmailVerification: true",
  "revokeSessionsOnPasswordReset: true","await sendEmail","Never share this link"]){
 assert.ok(server.includes(term),"Reset password server contract missing "+term);
}
assert.ok(!server.includes("console.log(url)"),"Reset token must not be logged");
const paths=[
 "apps/web/src/app/forgot-password/page.tsx",
 "apps/web/src/app/reset-password/page.tsx",
 "apps/web/src/app/login/page.tsx",
 "apps/web/src/app/register/page.tsx",
 "apps/web/src/app/auth/invite/[token]/page.tsx",
 "apps/web/src/app/onboarding/restaurant/page.tsx",
 "apps/web/src/app/[area]/account/page.tsx"
];
for(const path of paths){
 assert.ok(existsSync(new URL(path,root)),"Missing auth route "+path);
 const source=read(path);
 assert.ok(source.includes("au(locale"),"Missing localized auth UX on "+path);
 assert.ok(source.includes("disabled=")||source.includes("busyLock.current"),"Missing submission safety in "+path);
}
const login=read(paths[2]);
assert.ok(login.includes("validInviteRedirect"),"Login must prevent redirect to untrusted locations");
assert.ok(login.includes('"/forgot-password"'),"Password reset must be discoverable from login");
assert.ok(login.includes("expiredSession"),"Expired session must have user-facing recovery");
const register=read(paths[3]);
assert.ok(register.includes("password!==confirmPassword"),"Owner signup password confirmation required");
assert.ok(!register.includes('router.push("/onboarding/restaurant")'),"Unverified signup must not bypass verification");
const reset=read(paths[1]);
for(const term of ["resetPassword({newPassword:password,token})","history.replaceState","validPassword","password!==confirmPassword"]){
 assert.ok(reset.includes(term),"Reset token and password safety missing: "+term);
}
const forgot=read(paths[0]);
for(const term of ["requestPasswordReset","email.trim().toLowerCase()","resetSent"]){
 assert.ok(forgot.includes(term),"Recovery UX contract missing: "+term);
}
const invite=read(paths[4]);
for(const term of ["inviteWrongEmail","sameEmail","identity.user.verified","signOut()","validInviteRedirect","accept()","sendVerificationEmail"]){
 assert.ok(invite.includes(term)||term==="inviteWrongEmail"&&invite.includes("inviteMismatch"),"Invitation verification/identity guard missing: "+term);
}
const onboard=read(paths[5]);
for(const term of ["saveDraft()","AuthSteps","draft.acceptedTerms","slugInvalid","lastVerificationAt","randomUUID","/api/onboarding/complete"]){
 assert.ok(onboard.includes(term),"Setup progress/draft validation missing: "+term);
}
const account=read(paths[6]);
for(const term of ["authClient.updateUser","authClient.changePassword","authClient.listSessions",
 "authClient.getSession","authClient.revokeOtherSessions","authClient.revokeSession",
 "revokeOtherSessions:true","useInteraction","setWorkspace"]){
 assert.ok(account.includes(term),"Account profile or session controls missing: "+term);
}
const labels=read("apps/web/src/lib/auth-ux-copy.ts");
for(const lang of ['en:', '"fa-AF":', '"ps-AF":'])assert.ok(labels.includes(lang),"Missing language: "+lang);
const css=read("apps/web/src/app/auth-experience.css");
for(const selector of [".p18-auth-layout",".p18-password-shell",".p18-auth-steps",
 ".p18-session-list",".p18-account-tabs","@media(max-width:420px)","prefers-reduced-motion","@media print"]){
 assert.ok(css.includes(selector),"Missing responsive auth UI: "+selector);
}
const layout=read("apps/web/src/app/layout.tsx");
assert.ok(layout.indexOf("auth-experience.css")>layout.indexOf("interaction-system.css"));
console.log("Phase 18 authentication UX contract verified: password reset, invite/owner verification, profile, sessions, 3 languages, onboarding.");
