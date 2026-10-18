import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Operação Aprovação",
    short_name: "Aprovação",
    description: "Organize seus estudos para concursos públicos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#ffffff",
  };
}
