/* Flux staff directory — Bloomfield Independence East
 *
 * Source of truth for "who is a real teacher / counselor / staff member".
 * Used by the staff onboarding flow to:
 *   1. Populate the "Select your name" dropdown after a user picks Staff.
 *   2. Validate that the signed-in user's school email matches the
 *      directory entry, so impostors can't claim someone else's identity.
 *
 * Generated from scripts/staff-import-ia-east.jsonl. To update: edit the
 * JSONL, then re-export this file (or just edit this array directly —
 * it's the only thing that ships to the browser).
 */
(function(){
  'use strict';

  const directory=[
    {email:'lbelotti@bloomfield.org',         role:'staff',     name:'Lisa Belotti',         subject:''},
    {email:'abenitez@bloomfield.org',         role:'teacher',   name:'Alexander Benitez',    subject:''},
    {email:'wbernstein@bloomfield.org',       role:'counselor', name:'Whitney Bernstein',    subject:''},
    {email:'ebeski@bloomfield.org',           role:'teacher',   name:'Emily Beski',          subject:''},
    {email:'mchrzanowski@bloomfield.org',     role:'teacher',   name:'Mark Chrzanowski',     subject:''},
    {email:'cdaugherty@bloomfield.org',       role:'teacher',   name:'Chris Daugherty',      subject:''},
    {email:'tdolgin@bloomfield.org',          role:'teacher',   name:'Talia Dolgin',         subject:''},
    {email:'sdouglas-chong@bloomfield.org',   role:'teacher',   name:'Sharon Douglas-Chong', subject:''},
    {email:'aducharme@bloomfield.org',        role:'teacher',   name:'Aaron Ducharme',       subject:''},
    {email:'aellul@bloomfield.org',           role:'teacher',   name:'Amanda Ellul',         subject:''},
    {email:'tfair@bloomfield.org',            role:'staff',     name:'Tracey Fair',          subject:'Secretary'},
    {email:'jgarza@bloomfield.org',           role:'teacher',   name:'Jason Garza',          subject:''},
    {email:'pgriffin@bloomfield.org',         role:'admin',     name:'Patrick Griffin',      subject:'Principal'},
    {email:'jhallmark@bloomfield.org',        role:'teacher',   name:'Jamie Hallmark',       subject:''},
    {email:'nholevar@bloomfield.org',         role:'teacher',   name:'Nicholas Holevar',     subject:''},
    {email:'khosbach@bloomfield.org',         role:'teacher',   name:'Katherine Hosbach',    subject:'Fine Arts / Visual Arts'},
    {email:'ihwang@bloomfield.org',           role:'staff',     name:'InSeong Hwang',        subject:''},
    {email:'cjones@bloomfield.org',           role:'staff',     name:'Cecil Jones',          subject:'Safe-Ed'},
    {email:'tklein@bloomfield.org',           role:'teacher',   name:'Toby Klein',           subject:''},
    {email:'nkrstovski@bloomfield.org',       role:'staff',     name:'Nick Krstovski',       subject:'Technology / Computer Techs'},
    {email:'lkrutty@bloomfield.org',          role:'teacher',   name:'Lynne Krutty',         subject:''},
    {email:'jkurecka@bloomfield.org',         role:'teacher',   name:'James Kurecka',        subject:''},
    {email:'klavoie@bloomfield.org',          role:'teacher',   name:'Kristin Lavoie',       subject:'Library Services / Media'},
    {email:'mlograsso@bloomfield.org',        role:'teacher',   name:'Maria Lograsso',       subject:''},
    {email:'dlyons@bloomfield.org',           role:'teacher',   name:'David Lyons',          subject:''},
    {email:'tmack@bloomfield.org',            role:'staff',     name:'Tiffany Mack',         subject:''},
    {email:'nmayes@bloomfield.org',           role:'teacher',   name:'Nichole Mayes',        subject:'Instrumental Music / Vocal Music / Band & Orchestra'},
    {email:'jmccoy@bloomfield.org',           role:'staff',     name:'P. Jeff McCoy',        subject:''},
    {email:'amcsween@bloomfield.org',         role:'teacher',   name:'Amanda McSween',       subject:''},
    {email:'cmesclier@bloomfield.org',        role:'teacher',   name:'Courtney Mesclier',    subject:''},
    {email:'vmorang@bloomfield.org',          role:'staff',     name:'Vicki Morang',         subject:''},
    {email:'mmudalige@bloomfield.org',        role:'staff',     name:'Manori Mudalige',      subject:''},
    {email:'gnaus@bloomfield.org',            role:'admin',     name:'Gabrielle Naus',       subject:'Assistant Principal'},
    {email:'enewton@bloomfield.org',          role:'teacher',   name:'Elizabeth Newton',     subject:'Itinerant'},
    {email:'snorris@bloomfield.org',          role:'teacher',   name:'Shane Norris',         subject:''},
    {email:'kpaterson@bloomfield.org',        role:'teacher',   name:'Kelly Paterson',       subject:''},
    {email:'apeters@bloomfield.org',          role:'teacher',   name:'Amanda Peters',        subject:''},
    {email:'apetrovici@bloomfield.org',       role:'teacher',   name:'Amber Petrovici',      subject:'Substitute'},
    {email:'aphelps@bloomfield.org',          role:'counselor', name:'Alexandria Phelps',    subject:''},
    {email:'jrichardson@bloomfield.org',      role:'staff',     name:'Jennifer Richardson',  subject:'Secretary'},
    {email:'jrussell@bloomfield.org',         role:'teacher',   name:'Jenna Russell',        subject:''},
    {email:'nselweski@bloomfield.org',        role:'teacher',   name:'Natalie Selweski',     subject:''},
    {email:'ashankles@bloomfield.org',        role:'teacher',   name:'Andrew Shankles',      subject:'Instrumental Music / Band & Orchestra'},
    {email:'mszalkowski@bloomfield.org',      role:'teacher',   name:'Matthew Szalkowski',   subject:''},
    {email:'jtoepel@bloomfield.org',          role:'staff',     name:'Jackie Toepel',        subject:''},
    {email:'rwinn@bloomfield.org',            role:'staff',     name:'Roger Winn',           subject:''},
    {email:'mwisneski@bloomfield.org',        role:'staff',     name:'Mary Wisneski',        subject:''},
    {email:'ryousef@bloomfield.org',          role:'staff',     name:'Rene Yousef',          subject:''},
  ];

  // Decorate every entry so consumers can rely on a `displayRole` for UI and
  // `searchText` for case-insensitive name/email lookups.
  const ROLE_LABELS={teacher:'Teacher',counselor:'Counselor',staff:'Staff',admin:'Admin'};
  const enriched=directory.map(d=>({
    ...d,
    email:String(d.email||'').toLowerCase().trim(),
    role:String(d.role||'staff').toLowerCase().trim(),
    name:String(d.name||'').trim(),
    subject:String(d.subject||'').trim(),
    displayRole:ROLE_LABELS[String(d.role||'staff').toLowerCase()]||'Staff',
    searchText:(String(d.name||'')+' '+String(d.email||'')+' '+String(d.subject||'')).toLowerCase(),
  }));

  function findByEmail(email){
    if(!email)return null;
    const e=String(email).toLowerCase().trim();
    return enriched.find(d=>d.email===e)||null;
  }

  function listByRole(role){
    if(!role)return enriched.slice().sort((a,b)=>a.name.localeCompare(b.name));
    const r=String(role).toLowerCase();
    // Treat admin as a flavour of staff in the picker — admins still pick from
    // the staff list but their entry already carries role:'admin'.
    const want=(r==='staff')?['staff','admin']:[r];
    return enriched
      .filter(d=>want.includes(d.role))
      .sort((a,b)=>a.name.localeCompare(b.name));
  }

  function isAuthorized(email,role){
    const hit=findByEmail(email);
    if(!hit)return false;
    if(!role)return true;
    if(role==='staff')return hit.role==='staff'||hit.role==='admin';
    return hit.role===role;
  }

  window.FluxStaffDirectory={
    all:enriched,
    findByEmail,
    listByRole,
    isAuthorized,
    roleLabels:ROLE_LABELS,
  };
})();
