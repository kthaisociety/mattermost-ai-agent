import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { mattermostAgent } from "./agents/mattermost-agent";

export const mastra = new Mastra({
  agents: { mattermostAgent },
  storage: new LibSQLStore({
    id: "mastra",
    url: process.env.DATABASE_URL ?? "file:./mastra.db",
  }),
});
