(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.APP_CONFIG || {};
const URL = String(cfg.SUPABASE_URL || "").replace(/\/$/,"");
const KEY = cfg.SUPABASE_ANON_KEY || "";
const SESSION_KEY = "mp_private_session_v1";
const PR = {urgent:0,moderate:1,low:2};
const LABELS = {urgent:"Urgente",moderate:"Moderada",low:"Baixa"};
let session = null, patients = [], tasks = [], activePatient = null, editingPatient = null, busy=false, lastActivity=Date.now();
const headers = token => ({"apikey":KEY,"Content-Type":"application/json",...(token?{"Authorization":"Bearer "+token}:{})});
function saveSession(v){session=v;if(v)sessionStorage.setItem(SESSION_KEY,JSON.stringify(v));else sessionStorage.removeItem(SESSION_KEY);}
function showStatus(msg,error=false){$("status").textContent=msg||"";$("status").style.color=error?"#b92b3a":"#7b668f";}
function failMessage(x){return x?.message || "Não foi possível completar a operação.";}
async function request(path,opts={}){
  const {body,method="GET",auth=true,prefer} = opts;
  if(auth) await refreshIfNeeded();
  const h=headers(auth?session?.access_token:null);
  if(prefer)h["Prefer"]=prefer;
  const res=await fetch(URL+path,{method,headers:h,...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:"no-store"});
  const raw=await res.text();let json;
  try{json=raw?JSON.parse(raw):null;}catch{json={message:raw.slice(0,200)};}
  if(!res.ok) throw new Error(json?.msg||json?.error_description||json?.message||"Erro HTTP "+res.status);
  return json;
}
async function refreshIfNeeded(){
  if(!session)throw new Error("Entre novamente.");
  if(session.expires_at>Date.now()+90000)return;
  const r=await request("/auth/v1/token?grant_type=refresh_token",{auth:false,method:"POST",body:{refresh_token:session.refresh_token}});
  if(!r.access_token)throw new Error("Sessão expirada.");
  saveSession({...r,expires_at:Date.now()+r.expires_in*1000});
}
function authenticated(){return !!session;}
function showBoard(on){
  $("board").hidden=!on;$("auth").hidden=on;
  if(on){$("password").value="";showStatus("");}else{patients=[];tasks=[];$("cards").replaceChildren();}
}
function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function btn(label,cls,action){const b=el("button",cls,label);b.type="button";b.addEventListener("click",action);return b;}
function render(){
  const q=norm($("search").value);
  const list=patients.map(p=>({...p,tasks:tasks.filter(t=>t.patient_id===p.id)}))
    .filter(p=>norm(p.name).includes(q)||p.tasks.some(t=>norm(t.description).includes(q)))
    .sort((a,b)=>PR[a.priority]-PR[b.priority]||Date.parse(a.created_at)-Date.parse(b.created_at));
  $("counter").textContent=tasks.length+" pendência"+(tasks.length===1?"":"s");
  $("cards").replaceChildren();
  $("empty").hidden=list.length!==0;
  const emptyTitle=$("empty").querySelector("h3");
  emptyTitle.textContent=q?"Nenhum resultado encontrado":"Tudo em ordem por aqui!";
  for(const p of list){
    const card=el("article","card");card.dataset.priority=p.priority;
    card.append(el("div","card-bar"));
    const inside=el("div","card-inner"), head=el("div","card-head");
    head.append(el("h3","",p.name),el("span","badge",LABELS[p.priority]));
    inside.append(head);
    const ul=el("ul","task-list");
    for(const task of p.tasks){
      const li=el("li","task-row");
      const check=btn("","check",()=>completeTask(task.id));
      check.setAttribute("aria-label","Concluir: "+task.description);
      li.append(check,el("span","",task.description));ul.append(li);
    }
    inside.append(ul);
    const actions=el("div","card-actions");
    actions.append(btn("＋ Pendência","add",()=>openAddTask(p.id)));
    actions.append(btn("Editar","",()=>openEdit(p)));
    actions.append(btn("Excluir","",()=>deletePatient(p)));
    inside.append(actions);card.append(inside);$("cards").append(card);
  }
}
async function load(){
  if(!authenticated())return;
  try{
    const [ps,ts]=await Promise.all([
      request("/rest/v1/mp_patients?select=id,name,priority,created_at&order=created_at.asc"),
      request("/rest/v1/mp_tasks?select=id,patient_id,description,created_at&order=created_at.asc")
    ]);
    patients=ps||[];tasks=ts||[];render();showStatus("");
  }catch(err){showStatus(failMessage(err),true);}
}
async function run(action){
  if(busy)return false;
  busy=true;document.body.style.cursor="progress";
  try{await action();await load();return true;}
  catch(err){showStatus(failMessage(err),true);return false;}
  finally{busy=false;document.body.style.cursor="";}
}
async function completeTask(id){
  if(busy)return;
  await run(async()=>{
    const ok=await request("/rest/v1/rpc/mp_complete_task",{method:"POST",body:{p_task_id:id}});
    if(!ok)throw new Error("Pendência já removida ou indisponível.");
  });
}
function openCreate(){
  editingPatient=null;$("dialogTitle").textContent="Novo paciente";$("patientForm").reset();
  $("newTaskField").hidden=false;$("formError").textContent="";$("editor").showModal();$("patientName").focus();
}
function openEdit(patient){
  editingPatient=patient.id;$("dialogTitle").textContent="Editar cartão";
  $("patientName").value=patient.name;$("priority").value=patient.priority;
  $("newTaskField").hidden=true;$("formError").textContent="";
  $("editor").showModal();
}
$("patientForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("patientName").value.trim(),priority=$("priority").value;
  if(!name){$("formError").textContent="Informe o nome.";return;}
  let ok;
  if(editingPatient){
    ok=await run(()=>request("/rest/v1/mp_patients?id=eq."+encodeURIComponent(editingPatient),{method:"PATCH",body:{name,priority}}));
  }else{
    const list=$("tasksInput").value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(!list.length||list.length>100||list.some(s=>s.length>280)){
      $("formError").textContent="Informe de 1 a 100 pendências, até 280 caracteres por linha.";return;
    }
    ok=await run(()=>request("/rest/v1/rpc/mp_create_patient_with_tasks",{method:"POST",body:{p_name:name,p_priority:priority,p_tasks:list}}));
  }
  if(ok)$("editor").close();
  else $("formError").textContent=$("status").textContent;
});
function openAddTask(patientId){
  activePatient=patientId;$("addTaskForm").reset();$("taskError").textContent="";
  $("addTaskDialog").showModal();$("taskText").focus();
}
$("addTaskForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const description=$("taskText").value.trim();
  if(!description||description.length>280){$("taskError").textContent="Insira uma pendência de até 280 caracteres.";return;}
  const ok=await run(()=>request("/rest/v1/mp_tasks",{method:"POST",body:{patient_id:activePatient,description}}));
  if(ok)$("addTaskDialog").close();else $("taskError").textContent=$("status").textContent;
});
async function deletePatient(p){
  if(!confirm("Excluir o cartão de "+p.name+" e todas as suas pendências? Esta ação não pode ser desfeita."))return;
  await run(()=>request("/rest/v1/mp_patients?id=eq."+encodeURIComponent(p.id),{method:"DELETE"}));
}
async function login(e){
  e.preventDefault();$("loginError").textContent="";
  const email=$("email").value.trim(),password=$("password").value;
  const button=$("loginForm").querySelector("button[type=submit]");button.disabled=true;
  try{
    const r=await request("/auth/v1/token?grant_type=password",{auth:false,method:"POST",body:{email,password}});
    if(!r.access_token)throw new Error("Credenciais inválidas.");
    saveSession({...r,expires_at:Date.now()+r.expires_in*1000});
    lastActivity=Date.now();showBoard(true);await load();
  }catch(err){$("loginError").textContent=failMessage(err);saveSession(null);}
  finally{button.disabled=false;}
}
async function logout(){
  const token=session?.access_token;
  saveSession(null);showBoard(false);
  if(token){try{await fetch(URL+"/auth/v1/logout",{method:"POST",headers:headers(token)});}catch{}}
}
$("loginForm").addEventListener("submit",login);
$("newPatient").addEventListener("click",openCreate);
$("signOut").addEventListener("click",logout);
$("search").addEventListener("input",render);
$("closeDialog").addEventListener("click",()=>$("editor").close());
$("cancelEditor").addEventListener("click",()=>$("editor").close());
$("cancelTask").addEventListener("click",()=>$("addTaskDialog").close());
["keydown","pointerdown"].forEach(event=>document.addEventListener(event,()=>{lastActivity=Date.now()},{passive:true}));
setInterval(()=>{
 if(session && Date.now()-lastActivity>15*60*1000)logout();
 else if(session && !document.hidden)load();
},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden && session)load()});
try{
  const old=sessionStorage.getItem(SESSION_KEY);
  if(old)session=JSON.parse(old);
}catch{saveSession(null);}
if(session){showBoard(true);load()}else showBoard(false);
})();