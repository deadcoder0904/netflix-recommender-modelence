import { startApp } from "modelence/server";
import netflixModule from "@/server/netflix";
import { createDemoUser } from "@/server/migrations/createDemoUser";

startApp({
  modules: [netflixModule],

  migrations: [
    {
      version: 1,
      description: "Create demo user",
      handler: createDemoUser,
    },
  ],
});
