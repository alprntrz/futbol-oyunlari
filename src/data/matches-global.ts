import type { Match } from "@/lib/types";

/**
 * Recent (2005+) knockout matches for the global practice pool — Champions
 * League & World Cup semis/finals plus every UEFA Cup / Europa League final.
 * (No "turkiye" tag, so they surface under Pratik, not Türk Takımları.)
 * Factual lineups from Wikipedia; defence ordered right→left per formation slots.
 */
export const MATCHES_GLOBAL: Match[] = [
  {
    "id": "liverpool-real-2018",
    "competition": {
      "tr": "Şampiyonlar Ligi Finali",
      "en": "Champions League Final"
    },
    "season": "2017/18",
    "date": "26.05.2018",
    "team": "Liverpool",
    "opponent": "Real Madrid",
    "score": "1-3",
    "formation": "4-3-3",
    "kit": {
      "body": "#c8102e",
      "sleeves": "#c8102e",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "Loris Karius",
        "answer": "KARIUS",
        "number": 1
      },
      {
        "name": "Trent Alexander-Arnold",
        "answer": "ALEXANDERARNOLD",
        "number": 66
      },
      {
        "name": "Dejan Lovren",
        "answer": "LOVREN",
        "number": 6
      },
      {
        "name": "Virgil van Dijk",
        "answer": "VAN DIJK",
        "number": 4
      },
      {
        "name": "Andy Robertson",
        "answer": "ROBERTSON",
        "number": 26
      },
      {
        "name": "James Milner",
        "answer": "MILNER",
        "number": 7
      },
      {
        "name": "Jordan Henderson",
        "answer": "HENDERSON",
        "number": 14,
        "captain": true
      },
      {
        "name": "Georginio Wijnaldum",
        "answer": "WIJNALDUM",
        "number": 5
      },
      {
        "name": "Mohamed Salah",
        "answer": "SALAH",
        "number": 11
      },
      {
        "name": "Roberto Firmino",
        "answer": "FIRMINO",
        "number": 9
      },
      {
        "name": "Sadio Mané",
        "answer": "MANE",
        "number": 19,
        "goals": 1
      }
    ]
  },
  {
    "id": "real-liverpool-2018",
    "competition": {
      "tr": "Şampiyonlar Ligi Finali",
      "en": "Champions League Final"
    },
    "season": "2017/18",
    "date": "26.05.2018",
    "team": "Real Madrid",
    "opponent": "Liverpool",
    "score": "3-1",
    "formation": "4-3-1-2",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#1a1a1a"
    },
    "lineup": [
      {
        "name": "Keylor Navas",
        "answer": "NAVAS",
        "number": 1
      },
      {
        "name": "Dani Carvajal",
        "answer": "CARVAJAL",
        "number": 2
      },
      {
        "name": "Raphaël Varane",
        "answer": "VARANE",
        "number": 5
      },
      {
        "name": "Sergio Ramos",
        "answer": "RAMOS",
        "number": 4,
        "captain": true
      },
      {
        "name": "Marcelo",
        "answer": "MARCELO",
        "number": 12
      },
      {
        "name": "Casemiro",
        "answer": "CASEMIRO",
        "number": 14
      },
      {
        "name": "Luka Modrić",
        "answer": "MODRIC",
        "number": 10
      },
      {
        "name": "Toni Kroos",
        "answer": "KROOS",
        "number": 8
      },
      {
        "name": "Isco",
        "answer": "ISCO",
        "number": 22
      },
      {
        "name": "Karim Benzema",
        "answer": "BENZEMA",
        "number": 9,
        "goals": 1
      },
      {
        "name": "Cristiano Ronaldo",
        "answer": "RONALDO",
        "number": 7
      }
    ]
  },
  {
    "id": "sevilla-middlesbrough-2006",
    "competition": {
      "tr": "UEFA Kupası Finali",
      "en": "UEFA Cup Final"
    },
    "season": "2005/06",
    "date": "10.05.2006",
    "team": "Sevilla",
    "opponent": "Middlesbrough",
    "score": "4-0",
    "formation": "4-4-2",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#ce1126"
    },
    "lineup": [
      {
        "name": "Andrés Palop",
        "answer": "PALOP",
        "number": 1
      },
      {
        "name": "Dani Alves",
        "answer": "ALVES",
        "number": 4
      },
      {
        "name": "Javi Navarro",
        "answer": "NAVARRO",
        "number": 2,
        "captain": true
      },
      {
        "name": "Julien Escudé",
        "answer": "ESCUDE",
        "number": 6
      },
      {
        "name": "David Castedo",
        "answer": "CASTEDO",
        "number": 3
      },
      {
        "name": "Jesús Navas",
        "answer": "NAVAS",
        "number": 15
      },
      {
        "name": "José Luis Martí",
        "answer": "MARTI",
        "number": 18
      },
      {
        "name": "Enzo Maresca",
        "answer": "MARESCA",
        "number": 25,
        "goals": 2
      },
      {
        "name": "Adriano",
        "answer": "ADRIANO",
        "number": 16
      },
      {
        "name": "Luís Fabiano",
        "answer": "LUIS FABIANO",
        "number": 10,
        "goals": 1
      },
      {
        "name": "Javier Saviola",
        "answer": "SAVIOLA",
        "number": 7
      }
    ]
  },
  {
    "id": "sevilla-espanyol-2007",
    "competition": {
      "tr": "UEFA Kupası Finali",
      "en": "UEFA Cup Final"
    },
    "season": "2006/07",
    "date": "16.05.2007",
    "team": "Sevilla",
    "opponent": "Espanyol",
    "score": "2-2 (3-1 pen.)",
    "formation": "4-4-2",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#ce1126"
    },
    "lineup": [
      {
        "name": "Andrés Palop",
        "answer": "PALOP",
        "number": 1
      },
      {
        "name": "Dani Alves",
        "answer": "ALVES",
        "number": 4
      },
      {
        "name": "Javi Navarro",
        "answer": "NAVARRO",
        "number": 2,
        "captain": true
      },
      {
        "name": "Ivica Dragutinović",
        "answer": "DRAGUTINOVIC",
        "number": 19
      },
      {
        "name": "Antonio Puerta",
        "answer": "PUERTA",
        "number": 16
      },
      {
        "name": "José Luis Martí",
        "answer": "MARTI",
        "number": 18
      },
      {
        "name": "Christian Poulsen",
        "answer": "POULSEN",
        "number": 8
      },
      {
        "name": "Enzo Maresca",
        "answer": "MARESCA",
        "number": 25
      },
      {
        "name": "Adriano",
        "answer": "ADRIANO",
        "number": 6
      },
      {
        "name": "Frédéric Kanouté",
        "answer": "KANOUTE",
        "number": 12
      },
      {
        "name": "Luís Fabiano",
        "answer": "LUIS FABIANO",
        "number": 10
      }
    ]
  },
  {
    "id": "atletico-fulham-2010",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2009/10",
    "date": "12.05.2010",
    "team": "Atlético Madrid",
    "opponent": "Fulham",
    "score": "2-1 (u.d.)",
    "formation": "4-4-2",
    "kit": {
      "body": "#d81e05",
      "sleeves": "#ffffff",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "David de Gea",
        "answer": "DE GEA",
        "number": 43
      },
      {
        "name": "Tomáš Ujfaluši",
        "answer": "UJFALUSI",
        "number": 17
      },
      {
        "name": "Luis Perea",
        "answer": "PEREA",
        "number": 21
      },
      {
        "name": "Álvaro Domínguez",
        "answer": "DOMINGUEZ",
        "number": 18
      },
      {
        "name": "Antonio López",
        "answer": "LOPEZ",
        "number": 3,
        "captain": true
      },
      {
        "name": "José Antonio Reyes",
        "answer": "REYES",
        "number": 19
      },
      {
        "name": "Paulo Assunção",
        "answer": "ASSUNCAO",
        "number": 12
      },
      {
        "name": "Raúl García",
        "answer": "GARCIA",
        "number": 8
      },
      {
        "name": "Simão",
        "answer": "SIMAO",
        "number": 20
      },
      {
        "name": "Diego Forlán",
        "answer": "FORLAN",
        "number": 7,
        "goals": 2
      },
      {
        "name": "Sergio Agüero",
        "answer": "AGUERO",
        "number": 10
      }
    ]
  },
  {
    "id": "porto-braga-2011",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2010/11",
    "date": "18.05.2011",
    "team": "Porto",
    "opponent": "Braga",
    "score": "1-0",
    "formation": "4-3-3",
    "kit": {
      "body": "#004b9e",
      "sleeves": "#ffffff",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "Helton",
        "answer": "HELTON",
        "number": 1,
        "captain": true
      },
      {
        "name": "Cristian Săpunaru",
        "answer": "SAPUNARU",
        "number": 21
      },
      {
        "name": "Rolando",
        "answer": "ROLANDO",
        "number": 14
      },
      {
        "name": "Nicolás Otamendi",
        "answer": "OTAMENDI",
        "number": 30
      },
      {
        "name": "Álvaro Pereira",
        "answer": "PEREIRA",
        "number": 5
      },
      {
        "name": "Fredy Guarín",
        "answer": "GUARIN",
        "number": 6
      },
      {
        "name": "Fernando",
        "answer": "FERNANDO",
        "number": 25
      },
      {
        "name": "João Moutinho",
        "answer": "MOUTINHO",
        "number": 8
      },
      {
        "name": "Hulk",
        "answer": "HULK",
        "number": 12
      },
      {
        "name": "Radamel Falcao",
        "answer": "FALCAO",
        "number": 9,
        "goals": 1
      },
      {
        "name": "Silvestre Varela",
        "answer": "VARELA",
        "number": 17
      }
    ]
  },
  {
    "id": "atletico-bilbao-2012",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2011/12",
    "date": "09.05.2012",
    "team": "Atlético Madrid",
    "opponent": "Athletic Bilbao",
    "score": "3-0",
    "formation": "4-2-3-1",
    "kit": {
      "body": "#d81e05",
      "sleeves": "#ffffff",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "Thibaut Courtois",
        "answer": "COURTOIS",
        "number": 13
      },
      {
        "name": "Juanfran",
        "answer": "JUANFRAN",
        "number": 20
      },
      {
        "name": "Diego Godín",
        "answer": "GODIN",
        "number": 2
      },
      {
        "name": "Miranda",
        "answer": "MIRANDA",
        "number": 23
      },
      {
        "name": "Filipe Luís",
        "answer": "FILIPE LUIS",
        "number": 6
      },
      {
        "name": "Mario Suárez",
        "answer": "SUAREZ",
        "number": 4
      },
      {
        "name": "Gabi",
        "answer": "GABI",
        "number": 14,
        "captain": true
      },
      {
        "name": "Diego",
        "answer": "DIEGO",
        "number": 22,
        "goals": 1
      },
      {
        "name": "Adrián",
        "answer": "ADRIAN",
        "number": 7
      },
      {
        "name": "Arda Turan",
        "answer": "TURAN",
        "number": 11
      },
      {
        "name": "Radamel Falcao",
        "answer": "FALCAO",
        "number": 9,
        "goals": 2
      }
    ]
  },
  {
    "id": "chelsea-benfica-2013",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2012/13",
    "date": "15.05.2013",
    "team": "Chelsea",
    "opponent": "Benfica",
    "score": "2-1",
    "formation": "4-2-3-1",
    "kit": {
      "body": "#034694",
      "sleeves": "#034694",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "Petr Čech",
        "answer": "CECH",
        "number": 1
      },
      {
        "name": "César Azpilicueta",
        "answer": "AZPILICUETA",
        "number": 28
      },
      {
        "name": "Branislav Ivanović",
        "answer": "IVANOVIC",
        "number": 2,
        "goals": 1
      },
      {
        "name": "Gary Cahill",
        "answer": "CAHILL",
        "number": 24
      },
      {
        "name": "Ashley Cole",
        "answer": "COLE",
        "number": 3
      },
      {
        "name": "Frank Lampard",
        "answer": "LAMPARD",
        "number": 8,
        "captain": true
      },
      {
        "name": "David Luiz",
        "answer": "LUIZ",
        "number": 4
      },
      {
        "name": "Ramires",
        "answer": "RAMIRES",
        "number": 7
      },
      {
        "name": "Juan Mata",
        "answer": "MATA",
        "number": 10
      },
      {
        "name": "Oscar",
        "answer": "OSCAR",
        "number": 11
      },
      {
        "name": "Fernando Torres",
        "answer": "TORRES",
        "number": 9,
        "goals": 1
      }
    ]
  },
  {
    "id": "sevilla-benfica-2014",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2013/14",
    "date": "14.05.2014",
    "team": "Sevilla",
    "opponent": "Benfica",
    "score": "0-0 (4-2 pen.)",
    "formation": "4-2-3-1",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#ce1126"
    },
    "lineup": [
      {
        "name": "Beto",
        "answer": "BETO",
        "number": 13
      },
      {
        "name": "Coke",
        "answer": "COKE",
        "number": 23
      },
      {
        "name": "Nicolás Pareja",
        "answer": "PAREJA",
        "number": 21
      },
      {
        "name": "Federico Fazio",
        "answer": "FAZIO",
        "number": 2
      },
      {
        "name": "Alberto Moreno",
        "answer": "MORENO",
        "number": 16
      },
      {
        "name": "Stéphane Mbia",
        "answer": "MBIA",
        "number": 40
      },
      {
        "name": "Daniel Carriço",
        "answer": "CARRICO",
        "number": 6
      },
      {
        "name": "José Antonio Reyes",
        "answer": "REYES",
        "number": 19
      },
      {
        "name": "Ivan Rakitić",
        "answer": "RAKITIC",
        "number": 11,
        "captain": true
      },
      {
        "name": "Vitolo",
        "answer": "VITOLO",
        "number": 20
      },
      {
        "name": "Carlos Bacca",
        "answer": "BACCA",
        "number": 9
      }
    ]
  },
  {
    "id": "sevilla-liverpool-2016",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2015/16",
    "date": "18.05.2016",
    "team": "Sevilla",
    "opponent": "Liverpool",
    "score": "3-1",
    "formation": "4-2-3-1",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#ce1126"
    },
    "lineup": [
      {
        "name": "David Soria",
        "answer": "SORIA",
        "number": 31
      },
      {
        "name": "Mariano",
        "answer": "MARIANO",
        "number": 25
      },
      {
        "name": "Adil Rami",
        "answer": "RAMI",
        "number": 3
      },
      {
        "name": "Daniel Carriço",
        "answer": "CARRICO",
        "number": 6
      },
      {
        "name": "Sergio Escudero",
        "answer": "ESCUDERO",
        "number": 18
      },
      {
        "name": "Grzegorz Krychowiak",
        "answer": "KRYCHOWIAK",
        "number": 4
      },
      {
        "name": "Steven Nzonzi",
        "answer": "NZONZI",
        "number": 15
      },
      {
        "name": "Coke",
        "answer": "COKE",
        "number": 23,
        "captain": true,
        "goals": 2
      },
      {
        "name": "Éver Banega",
        "answer": "BANEGA",
        "number": 19
      },
      {
        "name": "Vitolo",
        "answer": "VITOLO",
        "number": 20
      },
      {
        "name": "Kevin Gameiro",
        "answer": "GAMEIRO",
        "number": 9,
        "goals": 1
      }
    ]
  },
  {
    "id": "manutd-ajax-2017",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2016/17",
    "date": "24.05.2017",
    "team": "Manchester United",
    "opponent": "Ajax",
    "score": "2-0",
    "formation": "4-1-4-1",
    "kit": {
      "body": "#da291c",
      "sleeves": "#da291c",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "Sergio Romero",
        "answer": "ROMERO",
        "number": 20
      },
      {
        "name": "Antonio Valencia",
        "answer": "VALENCIA",
        "number": 25,
        "captain": true
      },
      {
        "name": "Chris Smalling",
        "answer": "SMALLING",
        "number": 12
      },
      {
        "name": "Daley Blind",
        "answer": "BLIND",
        "number": 17
      },
      {
        "name": "Matteo Darmian",
        "answer": "DARMIAN",
        "number": 36
      },
      {
        "name": "Ander Herrera",
        "answer": "HERRERA",
        "number": 21
      },
      {
        "name": "Juan Mata",
        "answer": "MATA",
        "number": 8
      },
      {
        "name": "Marouane Fellaini",
        "answer": "FELLAINI",
        "number": 27
      },
      {
        "name": "Paul Pogba",
        "answer": "POGBA",
        "number": 6,
        "goals": 1
      },
      {
        "name": "Henrikh Mkhitaryan",
        "answer": "MKHITARYAN",
        "number": 22,
        "goals": 1
      },
      {
        "name": "Marcus Rashford",
        "answer": "RASHFORD",
        "number": 19
      }
    ]
  },
  {
    "id": "chelsea-arsenal-2019",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2018/19",
    "date": "29.05.2019",
    "team": "Chelsea",
    "opponent": "Arsenal",
    "score": "4-1",
    "formation": "4-3-3",
    "kit": {
      "body": "#034694",
      "sleeves": "#034694",
      "number": "#ffffff"
    },
    "lineup": [
      {
        "name": "Kepa Arrizabalaga",
        "answer": "ARRIZABALAGA",
        "number": 1
      },
      {
        "name": "César Azpilicueta",
        "answer": "AZPILICUETA",
        "number": 28,
        "captain": true
      },
      {
        "name": "Andreas Christensen",
        "answer": "CHRISTENSEN",
        "number": 27
      },
      {
        "name": "David Luiz",
        "answer": "LUIZ",
        "number": 30
      },
      {
        "name": "Emerson Palmieri",
        "answer": "PALMIERI",
        "number": 33
      },
      {
        "name": "N'Golo Kanté",
        "answer": "KANTE",
        "number": 7
      },
      {
        "name": "Jorginho",
        "answer": "JORGINHO",
        "number": 5
      },
      {
        "name": "Mateo Kovačić",
        "answer": "KOVACIC",
        "number": 17
      },
      {
        "name": "Pedro",
        "answer": "PEDRO",
        "number": 11,
        "goals": 1
      },
      {
        "name": "Olivier Giroud",
        "answer": "GIROUD",
        "number": 18,
        "goals": 1
      },
      {
        "name": "Eden Hazard",
        "answer": "HAZARD",
        "number": 10,
        "goals": 2
      }
    ]
  },
  {
    "id": "villarreal-manutd-2021",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2020/21",
    "date": "26.05.2021",
    "team": "Villarreal",
    "opponent": "Manchester United",
    "score": "1-1 (11-10 pen.)",
    "formation": "4-3-3",
    "kit": {
      "body": "#ffe667",
      "sleeves": "#ffe667",
      "number": "#005187"
    },
    "lineup": [
      {
        "name": "Gerónimo Rulli",
        "answer": "RULLI",
        "number": 13
      },
      {
        "name": "Juan Foyth",
        "answer": "FOYTH",
        "number": 8
      },
      {
        "name": "Raúl Albiol",
        "answer": "ALBIOL",
        "number": 3,
        "captain": true
      },
      {
        "name": "Pau Torres",
        "answer": "PAU TORRES",
        "number": 4
      },
      {
        "name": "Alfonso Pedraza",
        "answer": "PEDRAZA",
        "number": 24
      },
      {
        "name": "Dani Parejo",
        "answer": "PAREJO",
        "number": 5
      },
      {
        "name": "Étienne Capoue",
        "answer": "CAPOUE",
        "number": 25
      },
      {
        "name": "Manu Trigueros",
        "answer": "TRIGUEROS",
        "number": 14
      },
      {
        "name": "Gerard Moreno",
        "answer": "MORENO",
        "number": 7,
        "goals": 1
      },
      {
        "name": "Carlos Bacca",
        "answer": "BACCA",
        "number": 9
      },
      {
        "name": "Yeremy Pino",
        "answer": "PINO",
        "number": 30
      }
    ]
  },
  {
    "id": "sevilla-roma-2023",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2022/23",
    "date": "31.05.2023",
    "team": "Sevilla",
    "opponent": "Roma",
    "score": "1-1 (4-1 pen.)",
    "formation": "4-2-3-1",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#ce1126"
    },
    "lineup": [
      {
        "name": "Yassine Bounou",
        "answer": "BOUNOU",
        "number": 13
      },
      {
        "name": "Jesús Navas",
        "answer": "NAVAS",
        "number": 16,
        "captain": true
      },
      {
        "name": "Loïc Badé",
        "answer": "BADE",
        "number": 44
      },
      {
        "name": "Nemanja Gudelj",
        "answer": "GUDELJ",
        "number": 6
      },
      {
        "name": "Alex Telles",
        "answer": "TELLES",
        "number": 3
      },
      {
        "name": "Fernando",
        "answer": "FERNANDO",
        "number": 20
      },
      {
        "name": "Ivan Rakitić",
        "answer": "RAKITIC",
        "number": 10
      },
      {
        "name": "Lucas Ocampos",
        "answer": "OCAMPOS",
        "number": 55
      },
      {
        "name": "Óliver Torres",
        "answer": "OLIVER TORRES",
        "number": 21
      },
      {
        "name": "Bryan Gil",
        "answer": "GIL",
        "number": 25
      },
      {
        "name": "Youssef En-Nesyri",
        "answer": "ENNESYRI",
        "number": 15
      }
    ]
  },
  {
    "id": "tottenham-manutd-2025",
    "competition": {
      "tr": "UEFA Avrupa Ligi Finali",
      "en": "UEFA Europa League Final"
    },
    "season": "2024/25",
    "date": "21.05.2025",
    "team": "Tottenham Hotspur",
    "opponent": "Manchester United",
    "score": "1-0",
    "formation": "4-3-3",
    "kit": {
      "body": "#ffffff",
      "sleeves": "#ffffff",
      "number": "#132257"
    },
    "lineup": [
      {
        "name": "Guglielmo Vicario",
        "answer": "VICARIO",
        "number": 1
      },
      {
        "name": "Pedro Porro",
        "answer": "PORRO",
        "number": 23
      },
      {
        "name": "Cristian Romero",
        "answer": "ROMERO",
        "number": 17,
        "captain": true
      },
      {
        "name": "Micky van de Ven",
        "answer": "VAN DE VEN",
        "number": 37
      },
      {
        "name": "Destiny Udogie",
        "answer": "UDOGIE",
        "number": 13
      },
      {
        "name": "Pape Matar Sarr",
        "answer": "SARR",
        "number": 29
      },
      {
        "name": "Yves Bissouma",
        "answer": "BISSOUMA",
        "number": 8
      },
      {
        "name": "Rodrigo Bentancur",
        "answer": "BENTANCUR",
        "number": 30
      },
      {
        "name": "Brennan Johnson",
        "answer": "JOHNSON",
        "number": 22,
        "goals": 1
      },
      {
        "name": "Dominic Solanke",
        "answer": "SOLANKE",
        "number": 19
      },
      {
        "name": "Richarlison",
        "answer": "RICHARLISON",
        "number": 9
      }
    ]
  }
];
