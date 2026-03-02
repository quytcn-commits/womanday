import "@fastify/jwt";
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
    adminOnly: (req: any, reply: any) => Promise<void>;
  }
}
