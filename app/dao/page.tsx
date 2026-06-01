"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { Plus, RefreshCw, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import {
  TeamRecord,
  formatAddress,
  formatDate,
  formatTier,
  getReadOnlyContract,
  isContractConfigured,
} from "@/lib/silent-whale";

export default function DaoPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [name, setName] = useState("Wave desk");
  const [seatLimit, setSeatLimit] = useState("5");
  const [teamId, setTeamId] = useState("");
  const [member, setMember] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!address || !isContractConfigured()) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const count = Number(await contract.memberTeamCount(address));
      const ids = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          contract.memberTeamAt(address, index)
        )
      );
      const uniqueIds = Array.from(new Set(ids.map((id) => Number(id))));
      const nextTeams = await Promise.all(
        uniqueIds.map(async (id) => {
          const team = await contract.getTeam(id);
          return {
            id,
            teamOwner: team.teamOwner,
            nameHash: team.nameHash,
            tier: Number(team.tier),
            seatLimit: Number(team.seatLimit),
            memberCount: Number(team.memberCount),
            createdAt: Number(team.createdAt),
            active: team.active,
          } satisfies TeamRecord;
        })
      );
      setTeams(nextTeams);
    } catch (error: any) {
      setStatus(error?.message || "Could not load DAO teams.");
    }
  }, [address]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setStatus("Creating DAO team");
    try {
      const contract = await getWriteContract();
      const tx = await contract.createTeam(ethers.id(`${address}:${name}`), Number(seatLimit || "1"));
      await tx.wait();
      setStatus("DAO team created");
      await loadTeams();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Team creation failed.");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address) {
      await connect();
      return;
    }
    if (!ethers.isAddress(member)) {
      setStatus("Enter a valid member wallet.");
      return;
    }
    setBusy(true);
    setStatus("Adding team member");
    try {
      const contract = await getWriteContract();
      const tx = await contract.addTeamMember(Number(teamId || "0"), member);
      await tx.wait();
      setStatus("Team member added");
      await loadTeams();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Member update failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async () => {
    if (!address) {
      await connect();
      return;
    }
    if (!teamId || !ethers.isAddress(member)) {
      setStatus("Select a team and enter a valid member wallet.");
      return;
    }
    setBusy(true);
    setStatus("Removing team member");
    try {
      const contract = await getWriteContract();
      const tx = await contract.removeTeamMember(Number(teamId), member);
      await tx.wait();
      setStatus("Team member removed");
      await loadTeams();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Member removal failed.");
    } finally {
      setBusy(false);
    }
  };

  const updateSeats = async (targetTeamId: number) => {
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setStatus("Updating seat limit");
    try {
      const contract = await getWriteContract();
      const tx = await contract.setTeamSeatLimit(
        targetTeamId,
        Number(seatLimit || "1")
      );
      await tx.wait();
      setStatus("Seat limit updated");
      await loadTeams();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Seat update failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleTeam = async (team: TeamRecord) => {
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setStatus(team.active ? "Deactivating team" : "Reactivating team");
    try {
      const contract = await getWriteContract();
      const tx = await contract.setTeamActive(team.id, !team.active);
      await tx.wait();
      setStatus(team.active ? "Team deactivated" : "Team reactivated");
      await loadTeams();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Team update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame
      eyebrow="DAO Access"
      title="Shared decrypt desks."
      copy="DAO-tier subscribers can create a team and grant seats that inherit shared encrypted signal access while the owner subscription remains active."
    >
      <div className="grid gap-12 lg:grid-cols-12">
        <form onSubmit={createTeam} className="space-y-6 lg:col-span-5">
          <div className="flex items-center gap-3 text-sm text-white/50">
            <Users className="h-5 w-5 text-[#67e8f9]" />
            Create DAO workspace
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Team name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Seat limit</span>
            <input
              type="number"
              min="1"
              max="200"
              value={seatLimit}
              onChange={(event) => setSeatLimit(event.target.value)}
              className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
            />
          </label>
          <Button disabled={busy} className="h-12 rounded-full bg-white px-8 text-black hover:bg-white/90">
            <Plus className="mr-2 h-4 w-4" />
            {address ? "Create team" : "Connect wallet"}
          </Button>
        </form>

        <div className="space-y-8 border-t border-white/10 pt-8 lg:col-span-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <form onSubmit={addMember} className="space-y-6">
            <div className="flex items-center gap-3 text-sm text-white/50">
              <UserPlus className="h-5 w-5 text-[#fbbf24]" />
              Seat management
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-white/45">Team</span>
                <select
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  className="w-full border-b border-white/20 bg-background py-3 outline-none"
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      #{team.id} {formatTier(team.tier)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-white/45">Member wallet</span>
                <input
                  value={member}
                  onChange={(event) => setMember(event.target.value)}
                  placeholder="0x..."
                  className="w-full border-b border-white/20 bg-transparent py-3 font-mono text-sm outline-none focus:border-white"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={busy || !teamId} variant="outline" className="h-12 rounded-full border-white/20 bg-transparent px-8">
                Add member
              </Button>
              <Button
                type="button"
                disabled={busy || !teamId}
                onClick={removeMember}
                variant="outline"
                className="h-12 rounded-full border-white/20 bg-transparent px-8"
              >
                Remove member
              </Button>
            </div>
          </form>

          <Button
            onClick={loadTeams}
            variant="outline"
            className="rounded-full border-white/20 bg-transparent"
            disabled={!configured}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh teams
          </Button>

          {!configured ? (
            <EmptyState title="Contract is not configured." copy="Deploy the Wave 5 contract to enable teams." />
          ) : !address ? (
            <EmptyState title="Connect wallet." copy="Team rows are loaded for the connected wallet." />
          ) : teams.length === 0 ? (
            <EmptyState title="No teams found." copy="Create a DAO workspace after subscribing to DAO access." />
          ) : (
            <div className="divide-y divide-white/10 border-y border-white/10">
              {teams.map((team) => (
                <article key={team.id} className="grid gap-4 py-5 md:grid-cols-2">
                  <div>
                    <div className="mb-2 font-mono text-xs uppercase tracking-widest text-white/35">
                      #{team.id} / {formatDate(team.createdAt)}
                    </div>
                    <h2 className="font-display text-3xl">{formatTier(team.tier)} team</h2>
                    <p className="mt-2 text-sm text-white/45">Owner {formatAddress(team.teamOwner)}</p>
                  </div>
                  <div className="space-y-3 text-sm text-white/55">
                    <p>{team.memberCount} / {team.seatLimit} seats</p>
                    <p>{team.active ? "Active" : "Inactive"}</p>
                    <p className="break-all font-mono text-xs text-white/30">{team.nameHash}</p>
                    {address?.toLowerCase() === team.teamOwner.toLowerCase() ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => updateSeats(team.id)}
                          variant="outline"
                          className="h-9 rounded-full border-white/20 bg-transparent px-4"
                        >
                          Update seats
                        </Button>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => toggleTeam(team)}
                          variant="outline"
                          className="h-9 rounded-full border-white/20 bg-transparent px-4"
                        >
                          {team.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
