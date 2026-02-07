import z from "zod";
import { Module, ObjectId } from "modelence/server";
import { dbPicks } from "./db";

const ITEMS_PER_PAGE = 20;

const GENRES = [
  "Drama",
  "Comedy",
  "Thriller",
  "Sci-Fi",
  "Horror",
  "Action",
  "Romance",
  "Documentary",
  "Animation",
  "Mystery",
  "Fantasy",
  "Crime",
];

const TYPES = ["movie", "show"];
const RATINGS = ["G", "PG", "PG-13", "R", "TV-Y", "TV-G", "TV-PG", "TV-14", "TV-MA"];
const ORDER_BY_OPTIONS = ["relevance", "year_desc", "year_asc", "title_asc", "title_desc"];

type Pick = {
  _id: ObjectId;
  title: string;
  type: string;
  rating: string;
  year: number;
  description: string;
  genres: string[];
  imageUrl?: string;
  createdAt: Date;
};

const picksSchema = z.object({
  page: z.number().min(1).default(1),
});

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.number().min(1).default(1),
  type: z.string().optional(),
  rating: z.string().optional(),
  year: z.string().optional(),
  genre: z.string().optional(),
  orderBy: z.string().optional(),
});

function buildQuery(params: z.infer<typeof searchSchema>) {
  const query: Record<string, unknown> = {};

  if (params.type && params.type !== "") {
    query.type = params.type;
  }

  if (params.rating && params.rating !== "") {
    query.rating = params.rating;
  }

  if (params.year && params.year !== "") {
    const yearNum = parseInt(params.year, 10);
    if (!isNaN(yearNum)) {
      query.year = yearNum;
    }
  }

  if (params.genre && params.genre !== "") {
    query.genres = params.genre;
  }

  return query;
}

function buildSort(orderBy?: string) {
  if (orderBy === "year_desc") return { year: -1 as const, _id: -1 as const };
  if (orderBy === "year_asc") return { year: 1 as const, _id: 1 as const };
  if (orderBy === "title_asc") return { title: 1 as const, _id: 1 as const };
  if (orderBy === "title_desc") return { title: -1 as const, _id: -1 as const };
  return { createdAt: -1 as const, _id: -1 as const };
}

function formatPick(pick: Pick) {
  return {
    _id: pick._id.toString(),
    title: pick.title,
    type: pick.type,
    rating: pick.rating,
    year: pick.year,
    description: pick.description,
    genres: pick.genres,
    imageUrl: pick.imageUrl,
  };
}

export default new Module("picks", {
  stores: [dbPicks],

  queries: {
    getPicks: async (args: unknown) => {
      const { page } = picksSchema.parse(args);
      const skip = (page - 1) * ITEMS_PER_PAGE;

      const picks = await dbPicks.fetch(
        {},
        {
          sort: { createdAt: -1 },
          limit: ITEMS_PER_PAGE,
          skip,
        },
      );

      // Get total count by fetching all IDs (workaround)
      const allPicks = await dbPicks.fetch({}, { limit: 10000 });
      const totalCount = allPicks.length;

      return {
        picks: picks.map(formatPick),
        pagination: {
          page,
          totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
          totalCount,
          hasNext: page * ITEMS_PER_PAGE < totalCount,
          hasPrev: page > 1,
        },
        filters: {
          genres: GENRES,
          types: TYPES,
          ratings: RATINGS,
          orderByOptions: ORDER_BY_OPTIONS,
        },
      };
    },

    search: async (args: unknown) => {
      const params = searchSchema.parse(args);
      const skip = (params.page - 1) * ITEMS_PER_PAGE;
      const baseQuery = buildQuery(params);

      const query: Record<string, unknown> = { ...baseQuery };
      const hasTextSearch = params.q && params.q.trim() !== "";

      if (hasTextSearch) {
        query.$text = { $search: params.q };
      }

      const sort = buildSort(params.orderBy);

      const picks = await dbPicks.fetch(query, {
        sort,
        limit: ITEMS_PER_PAGE,
        skip,
      });

      // Get total count for this query
      const allMatching = await dbPicks.fetch(query, { limit: 10000 });
      const totalCount = allMatching.length;

      return {
        picks: picks.map(formatPick),
        query: params.q || "",
        pagination: {
          page: params.page,
          totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
          totalCount,
          hasNext: params.page * ITEMS_PER_PAGE < totalCount,
          hasPrev: params.page > 1,
        },
        filters: {
          genres: GENRES,
          types: TYPES,
          ratings: RATINGS,
          orderByOptions: ORDER_BY_OPTIONS,
        },
      };
    },
  },

  mutations: {
    seedPicks: async () => {
      // Sample seed data for testing
      // TMDB poster base URL: https://image.tmdb.org/t/p/w500/
      const samplePicks = [
        {
          title: "Inception",
          type: "movie",
          rating: "PG-13",
          year: 2010,
          description:
            "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
          genres: ["Sci-Fi", "Action", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        },
        {
          title: "Breaking Bad",
          type: "show",
          rating: "TV-MA",
          year: 2008,
          description:
            "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine to secure his family's future.",
          genres: ["Drama", "Crime", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
        },
        {
          title: "The Prestige",
          type: "movie",
          rating: "PG-13",
          year: 2006,
          description:
            "After a tragic accident, two stage magicians engage in a battle to create the ultimate illusion while sacrificing everything they have.",
          genres: ["Drama", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/bdN3gXuIZYaJP7ftKK2sU0nPtEA.jpg",
        },
        {
          title: "Stranger Things",
          type: "show",
          rating: "TV-14",
          year: 2016,
          description:
            "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.",
          genres: ["Drama", "Fantasy", "Horror"],
          imageUrl: "https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
        },
        {
          title: "Interstellar",
          type: "movie",
          rating: "PG-13",
          year: 2014,
          description:
            "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
          genres: ["Sci-Fi", "Drama", "Adventure"],
          imageUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        },
        {
          title: "The Dark Knight",
          type: "movie",
          rating: "PG-13",
          year: 2008,
          description:
            "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological tests of his ability to fight injustice.",
          genres: ["Action", "Crime", "Drama"],
          imageUrl: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        },
        {
          title: "True Detective",
          type: "show",
          rating: "TV-MA",
          year: 2014,
          description:
            "Anthology series in which police investigations unearth the personal and professional secrets of those involved, both within and outside the law.",
          genres: ["Crime", "Drama", "Mystery"],
          imageUrl: "https://image.tmdb.org/t/p/w500/cuV2O5ZyDLHSOWzg3nLVljp1ubw.jpg",
        },
        {
          title: "Parasite",
          type: "movie",
          rating: "R",
          year: 2019,
          description:
            "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
          genres: ["Drama", "Thriller", "Comedy"],
          imageUrl: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
        },
        {
          title: "Severance",
          type: "show",
          rating: "TV-MA",
          year: 2022,
          description:
            "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
          genres: ["Drama", "Mystery", "Sci-Fi"],
          imageUrl: "https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg",
        },
        {
          title: "Arrival",
          type: "movie",
          rating: "PG-13",
          year: 2016,
          description:
            "A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world.",
          genres: ["Drama", "Mystery", "Sci-Fi"],
          imageUrl: "https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
        },
        {
          title: "The Shining",
          type: "movie",
          rating: "R",
          year: 1980,
          description:
            "A family heads to an isolated hotel for the winter where a sinister presence influences the father into violence.",
          genres: ["Drama", "Horror"],
          imageUrl: "https://image.tmdb.org/t/p/w500/xazWoLealQwEgqZ89MLZklLZD3k.jpg",
        },
        {
          title: "Black Mirror",
          type: "show",
          rating: "TV-MA",
          year: 2011,
          description:
            "An anthology series exploring a twisted, high-tech multiverse where humanity's greatest innovations and darkest instincts collide.",
          genres: ["Drama", "Sci-Fi", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/7PRddO7z7mcPi21nMbDjM76XyXn.jpg",
        },
        {
          title: "Get Out",
          type: "movie",
          rating: "R",
          year: 2017,
          description:
            "A young African-American visits his white girlfriend's parents for the weekend, where his simmering uneasiness about their reception of him eventually reaches a boiling point.",
          genres: ["Horror", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
        },
        {
          title: "The Wire",
          type: "show",
          rating: "TV-MA",
          year: 2002,
          description:
            "The Baltimore drug scene, as seen through the eyes of drug dealers and law enforcement.",
          genres: ["Crime", "Drama"],
          imageUrl: "https://image.tmdb.org/t/p/w500/4lbclFySvugI51fwsyxBTOm4DqK.jpg",
        },
        {
          title: "Memento",
          type: "movie",
          rating: "R",
          year: 2000,
          description:
            "A man with short-term memory loss attempts to track down his wife's murderer.",
          genres: ["Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/yuNs09hvpHVU1cBTCAk9zxsL2oW.jpg",
        },
        {
          title: "Mindhunter",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "In the late 1970s, two FBI agents broaden the realm of criminal science by investigating the psychology behind murder.",
          genres: ["Crime", "Drama", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/bTRAx2epmxkWN2WGGkG2RhNiFKe.jpg",
        },
        {
          title: "Gone Girl",
          type: "movie",
          rating: "R",
          year: 2014,
          description:
            "With his wife's disappearance having become the focus of an intense media circus, a man sees the spotlight turned on him when it's suspected that he may not be innocent.",
          genres: ["Drama", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/lv5xShBIDPe7m6u4kbvnEVaKYe4.jpg",
        },
        {
          title: "Ozark",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "A financial advisor drags his family from Chicago to the Missouri Ozarks, where he must launder money to appease a drug boss.",
          genres: ["Crime", "Drama", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/pCGyPVrI9Fzw6KENHlHF4F4l8RD.jpg",
        },
        {
          title: "Shutter Island",
          type: "movie",
          rating: "R",
          year: 2010,
          description:
            "In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane.",
          genres: ["Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/kve20tXwUZpu4GUX8l6X7Z4jmL6.jpg",
        },
        {
          title: "The Handmaid's Tale",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "Set in a dystopian future, a woman is forced to live as a concubine under a fundamentalist theocratic dictatorship.",
          genres: ["Drama", "Sci-Fi", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/oIkxqt6ug5zT1UebunscUoOqKjC.jpg",
        },
        {
          title: "The Sixth Sense",
          type: "movie",
          rating: "PG-13",
          year: 1999,
          description:
            "A frightened, withdrawn Philadelphia boy who communicates with spirits seeks the help of a disheartened child psychologist.",
          genres: ["Drama", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/fIssD3w3SvIhPPmVo4WMgZDVLID.jpg",
        },
        {
          title: "Dark",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "A family saga with a supernatural twist, set in a German town where the disappearance of two young children exposes relationships among four families.",
          genres: ["Crime", "Drama", "Mystery"],
          imageUrl: "https://image.tmdb.org/t/p/w500/5LoMvjRXEBMNyYBtIC2k1RjiRJT.jpg",
        },
        {
          title: "The Matrix",
          type: "movie",
          rating: "R",
          year: 1999,
          description:
            "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is the elaborate deception of an evil cyber-intelligence.",
          genres: ["Action", "Sci-Fi"],
          imageUrl: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        },
        {
          title: "Mr. Robot",
          type: "show",
          rating: "TV-MA",
          year: 2015,
          description:
            "Elliot, a brilliant but highly unstable young cyber-security engineer and vigilante hacker, becomes a key figure in a complex game of global dominance.",
          genres: ["Crime", "Drama", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/oKIBhzZzDX07SoE2bOLhq2EE8rf.jpg",
        },
        {
          title: "Oldboy",
          type: "movie",
          rating: "R",
          year: 2003,
          description:
            "After being kidnapped and imprisoned for fifteen years, Oh Dae-Su is released, only to find that he must find his captor in five days.",
          genres: ["Action", "Drama", "Mystery"],
          imageUrl: "https://image.tmdb.org/t/p/w500/pWDtjs568ZfOTMbURQBYuT4Qxka.jpg",
        },
      ];

      // Check existing data
      const existingPicks = await dbPicks.fetch({}, { limit: 1 });
      if (existingPicks.length > 0) {
        const allPicks = await dbPicks.fetch({}, { limit: 10000 });
        return { message: "Data already seeded", count: allPicks.length };
      }

      // Insert sample data
      for (const pick of samplePicks) {
        await dbPicks.insertOne({
          ...pick,
          createdAt: new Date(),
        });
      }

      return { message: "Seeded successfully", count: samplePicks.length };
    },

    clearAndReseed: async () => {
      // Clear all existing picks
      const existingPicks = await dbPicks.fetch({}, { limit: 10000 });
      for (const pick of existingPicks) {
        await dbPicks.deleteOne({ _id: pick._id });
      }

      // TMDB poster base URL: https://image.tmdb.org/t/p/w500/
      const samplePicks = [
        {
          title: "Inception",
          type: "movie",
          rating: "PG-13",
          year: 2010,
          description:
            "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
          genres: ["Sci-Fi", "Action", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        },
        {
          title: "Breaking Bad",
          type: "show",
          rating: "TV-MA",
          year: 2008,
          description:
            "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine to secure his family's future.",
          genres: ["Drama", "Crime", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
        },
        {
          title: "The Prestige",
          type: "movie",
          rating: "PG-13",
          year: 2006,
          description:
            "After a tragic accident, two stage magicians engage in a battle to create the ultimate illusion while sacrificing everything they have.",
          genres: ["Drama", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/bdN3gXuIZYaJP7ftKK2sU0nPtEA.jpg",
        },
        {
          title: "Stranger Things",
          type: "show",
          rating: "TV-14",
          year: 2016,
          description:
            "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.",
          genres: ["Drama", "Fantasy", "Horror"],
          imageUrl: "https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
        },
        {
          title: "Interstellar",
          type: "movie",
          rating: "PG-13",
          year: 2014,
          description:
            "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
          genres: ["Sci-Fi", "Drama", "Adventure"],
          imageUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        },
        {
          title: "The Dark Knight",
          type: "movie",
          rating: "PG-13",
          year: 2008,
          description:
            "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological tests of his ability to fight injustice.",
          genres: ["Action", "Crime", "Drama"],
          imageUrl: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        },
        {
          title: "True Detective",
          type: "show",
          rating: "TV-MA",
          year: 2014,
          description:
            "Anthology series in which police investigations unearth the personal and professional secrets of those involved, both within and outside the law.",
          genres: ["Crime", "Drama", "Mystery"],
          imageUrl: "https://image.tmdb.org/t/p/w500/cuV2O5ZyDLHSOWzg3nLVljp1ubw.jpg",
        },
        {
          title: "Parasite",
          type: "movie",
          rating: "R",
          year: 2019,
          description:
            "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
          genres: ["Drama", "Thriller", "Comedy"],
          imageUrl: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
        },
        {
          title: "Severance",
          type: "show",
          rating: "TV-MA",
          year: 2022,
          description:
            "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
          genres: ["Drama", "Mystery", "Sci-Fi"],
          imageUrl: "https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg",
        },
        {
          title: "Arrival",
          type: "movie",
          rating: "PG-13",
          year: 2016,
          description:
            "A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world.",
          genres: ["Drama", "Mystery", "Sci-Fi"],
          imageUrl: "https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
        },
        {
          title: "The Shining",
          type: "movie",
          rating: "R",
          year: 1980,
          description:
            "A family heads to an isolated hotel for the winter where a sinister presence influences the father into violence.",
          genres: ["Drama", "Horror"],
          imageUrl: "https://image.tmdb.org/t/p/w500/xazWoLealQwEgqZ89MLZklLZD3k.jpg",
        },
        {
          title: "Black Mirror",
          type: "show",
          rating: "TV-MA",
          year: 2011,
          description:
            "An anthology series exploring a twisted, high-tech multiverse where humanity's greatest innovations and darkest instincts collide.",
          genres: ["Drama", "Sci-Fi", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/7PRddO7z7mcPi21nMbDjM76XyXn.jpg",
        },
        {
          title: "Get Out",
          type: "movie",
          rating: "R",
          year: 2017,
          description:
            "A young African-American visits his white girlfriend's parents for the weekend, where his simmering uneasiness about their reception of him eventually reaches a boiling point.",
          genres: ["Horror", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
        },
        {
          title: "The Wire",
          type: "show",
          rating: "TV-MA",
          year: 2002,
          description:
            "The Baltimore drug scene, as seen through the eyes of drug dealers and law enforcement.",
          genres: ["Crime", "Drama"],
          imageUrl: "https://image.tmdb.org/t/p/w500/4lbclFySvugI51fwsyxBTOm4DqK.jpg",
        },
        {
          title: "Memento",
          type: "movie",
          rating: "R",
          year: 2000,
          description:
            "A man with short-term memory loss attempts to track down his wife's murderer.",
          genres: ["Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/yuNs09hvpHVU1cBTCAk9zxsL2oW.jpg",
        },
        {
          title: "Mindhunter",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "In the late 1970s, two FBI agents broaden the realm of criminal science by investigating the psychology behind murder.",
          genres: ["Crime", "Drama", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/bTRAx2epmxkWN2WGGkG2RhNiFKe.jpg",
        },
        {
          title: "Gone Girl",
          type: "movie",
          rating: "R",
          year: 2014,
          description:
            "With his wife's disappearance having become the focus of an intense media circus, a man sees the spotlight turned on him when it's suspected that he may not be innocent.",
          genres: ["Drama", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/lv5xShBIDPe7m6u4kbvnEVaKYe4.jpg",
        },
        {
          title: "Ozark",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "A financial advisor drags his family from Chicago to the Missouri Ozarks, where he must launder money to appease a drug boss.",
          genres: ["Crime", "Drama", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/pCGyPVrI9Fzw6KENHlHF4F4l8RD.jpg",
        },
        {
          title: "Shutter Island",
          type: "movie",
          rating: "R",
          year: 2010,
          description:
            "In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane.",
          genres: ["Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/kve20tXwUZpu4GUX8l6X7Z4jmL6.jpg",
        },
        {
          title: "The Handmaid's Tale",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "Set in a dystopian future, a woman is forced to live as a concubine under a fundamentalist theocratic dictatorship.",
          genres: ["Drama", "Sci-Fi", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/oIkxqt6ug5zT1UebunscUoOqKjC.jpg",
        },
        {
          title: "The Sixth Sense",
          type: "movie",
          rating: "PG-13",
          year: 1999,
          description:
            "A frightened, withdrawn Philadelphia boy who communicates with spirits seeks the help of a disheartened child psychologist.",
          genres: ["Drama", "Mystery", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/fIssD3w3SvIhPPmVo4WMgZDVLID.jpg",
        },
        {
          title: "Dark",
          type: "show",
          rating: "TV-MA",
          year: 2017,
          description:
            "A family saga with a supernatural twist, set in a German town where the disappearance of two young children exposes relationships among four families.",
          genres: ["Crime", "Drama", "Mystery"],
          imageUrl: "https://image.tmdb.org/t/p/w500/5LoMvjRXEBMNyYBtIC2k1RjiRJT.jpg",
        },
        {
          title: "The Matrix",
          type: "movie",
          rating: "R",
          year: 1999,
          description:
            "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is the elaborate deception of an evil cyber-intelligence.",
          genres: ["Action", "Sci-Fi"],
          imageUrl: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        },
        {
          title: "Mr. Robot",
          type: "show",
          rating: "TV-MA",
          year: 2015,
          description:
            "Elliot, a brilliant but highly unstable young cyber-security engineer and vigilante hacker, becomes a key figure in a complex game of global dominance.",
          genres: ["Crime", "Drama", "Thriller"],
          imageUrl: "https://image.tmdb.org/t/p/w500/oKIBhzZzDX07SoE2bOLhq2EE8rf.jpg",
        },
        {
          title: "Oldboy",
          type: "movie",
          rating: "R",
          year: 2003,
          description:
            "After being kidnapped and imprisoned for fifteen years, Oh Dae-Su is released, only to find that he must find his captor in five days.",
          genres: ["Action", "Drama", "Mystery"],
          imageUrl: "https://image.tmdb.org/t/p/w500/pWDtjs568ZfOTMbURQBYuT4Qxka.jpg",
        },
      ];

      // Insert sample data
      for (const pick of samplePicks) {
        await dbPicks.insertOne({
          ...pick,
          createdAt: new Date(),
        });
      }

      return { message: "Cleared and reseeded successfully", count: samplePicks.length };
    },
  },
});
