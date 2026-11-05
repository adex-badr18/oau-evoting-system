import { createHash } from "node:crypto";
import { inTransaction } from "../database";
import { assertAdminAssigned, writeAuditEvent } from "../admin/election-service";

export async function approveElection(electionId:string, officerId:string) {
  return inTransaction(async client=>{
    await assertAdminAssigned(client,electionId,officerId);
    const election=await client.query<{title:string;status:string;starts_at:Date;ends_at:Date}>(`SELECT title,status,starts_at,ends_at FROM elections WHERE id=$1 FOR UPDATE`,[electionId]);
    if(election.rowCount!==1) throw Error("Election not found.");
    if(election.rows[0].status==='APPROVED') throw Error("This election has already been approved.");
    if(election.rows[0].status==='SCHEDULED' && election.rows[0].ends_at <= new Date()) await client.query("UPDATE elections SET status='CLOSED', updated_at=now() WHERE id=$1", [electionId]);
    if(election.rows[0].status!=='CLOSED' && !(election.rows[0].status==='SCHEDULED' && election.rows[0].ends_at <= new Date())) throw Error("Election must be closed before approval.");
    const totals=await client.query<{eligible:string;ballots:string;voted:string}>(`SELECT (SELECT count(*) FROM eligible_voters WHERE election_id=$1) eligible,(SELECT count(*) FROM ballots WHERE election_id=$1) ballots,(SELECT count(*) FROM eligible_voters WHERE election_id=$1 AND has_voted=true) voted`,[electionId]);
    if(totals.rows[0].ballots!==totals.rows[0].voted) throw Error("Integrity check failed: ballot and voter-submission totals do not match.");
    const results=await client.query<{position:string;candidate:string;votes:string}>(`SELECT p.title position,c.full_name candidate,count(bs.candidate_id) votes FROM positions p JOIN candidates c ON c.position_id=p.id LEFT JOIN ballot_selections bs ON bs.candidate_id=c.id WHERE p.election_id=$1 GROUP BY p.id,p.title,c.id,c.full_name ORDER BY p.display_order,c.display_order`,[electionId]);
    const report={reportVersion:1,electionId,title:election.rows[0].title,startsAt:election.rows[0].starts_at,endsAt:election.rows[0].ends_at,approvedAt:new Date().toISOString(),eligibleVoters:Number(totals.rows[0].eligible),ballotsSubmitted:Number(totals.rows[0].ballots),turnout:Number(totals.rows[0].eligible)?Math.round(Number(totals.rows[0].ballots)/Number(totals.rows[0].eligible)*10000)/100:0,results:results.rows.map(r=>({position:r.position,candidate:r.candidate,votes:Number(r.votes)}))};
    const content=JSON.stringify(report); const hash=createHash("sha256").update(content).digest("hex");
    await client.query(`UPDATE elections SET status='APPROVED',approved_by=$1,approved_at=now(),updated_at=now() WHERE id=$2`,[officerId,electionId]);
    await client.query(`INSERT INTO reports (election_id,storage_key,content_hash,report_data,generated_by) VALUES ($1,$2,$3,$4::jsonb,$5)`,[electionId,`reports/${electionId}/official-result.json`,hash,content,officerId]);
    await writeAuditEvent(client,officerId,"ELECTION_APPROVED",electionId,true,{reportHash:hash});
    return {report,contentHash:hash};
  });
}

export async function anonymiseVoters(electionId:string, administratorId:string) {
  return inTransaction(async client=>{
    await assertAdminAssigned(client,electionId,administratorId);
    const election=await client.query<{status:string}>(`SELECT status FROM elections WHERE id=$1 FOR UPDATE`,[electionId]);
    if(election.rowCount!==1||election.rows[0].status!=="APPROVED") throw Error("Only an approved election may be cleaned up.");
    const result=await client.query(`UPDATE eligible_voters SET full_name='ANONYMISED',department='ANONYMISED',email='deleted-'||id||'@invalid.local',matric_number=NULL,faculty=NULL,password_hash=NULL,credential_expires_at=NULL,voter_status='ANONYMISED',updated_at=now() WHERE election_id=$1 AND voter_status<>'ANONYMISED'`,[electionId]);
    await writeAuditEvent(client,administratorId,"VOTER_DATA_ANONYMISED",electionId,true,{count:result.rowCount});
    return {anonymised:result.rowCount??0, completedAt:new Date().toISOString()};
  });
}
