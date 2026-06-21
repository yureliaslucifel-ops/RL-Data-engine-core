# RL-Data-engine-code

Serveur de recuperation des statistiques Rocket League pour un overlay dual-PC.

Ce projet n'est pas l'overlay. C'est la couche data reseau :

```text
Rocket League Stats API
  -> src/api/rl_stats_api.ts
  -> EventBus
  -> StateEngine
  -> SessionEngine
  -> SnapshotBuilder
  -> WebSocket Server
  -> PC stream / overlay
```

## Pourquoi ce projet existe

La Rocket League Stats API est locale au PC de jeu. En setup dual-PC, le PC stream ne peut pas lire directement les statistiques du jeu.

Ce serveur tourne donc sur le PC de jeu, lit les donnees locales de Rocket League, puis expose un WebSocket accessible depuis le PC stream.

## Structure

```text
src/
  api/
    rl_stats_api.ts
  core/
    event_bus.ts
    priority_router.ts
  collectors/
    match_collector.ts
  state/
    state_engine.ts
    match_state.ts
  session/
    session_engine.ts
    playlist_aggregator.ts
  websocket/
    ws_server.ts
    snapshot_builder.ts
  storage/
    sqlite/
  config/
  utils/
  logs/
  index.ts
```

## Prerequis Rocket League

Activer la Stats API dans le fichier Rocket League :

```text
<Install Dir>\TAGame\Config\DefaultStatsAPI.ini
```

Parametres importants :

```ini
PacketSendRate=30
Port=49123
```

Si `PacketSendRate` vaut `0`, Rocket League n'envoie pas les donnees.

## Installation

```bash
npm install
```

Si tu utilises `pnpm` au lieu de `npm`, `sqlite3` peut demander une validation de build :

```bash
pnpm approve-builds
pnpm install
```

## Lancement en developpement

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Configuration

Variables d'environnement disponibles :

```text
RL_STATS_HOST=127.0.0.1
RL_STATS_PORT=49123
OVERLAY_HOST=0.0.0.0
OVERLAY_PORT=8080
DATABASE_PATH=data/rl-data-engine.sqlite
```

En dual-PC, l'overlay du PC stream doit se connecter a :

```text
ws://IP_DU_PC_JEU:8080
```

Il faut autoriser le port `8080` dans le pare-feu Windows du PC de jeu.

## Stockage

Le projet garde une base SQLite locale pour conserver les evenements importants :

- evenements de session et de match ;
- buts ;
- fin de match ;
- snapshots de fin de match.

Par defaut, la base est creee ici :

```text
data/rl-data-engine.sqlite
```

Le flux `UpdateState` complet n'est pas stocke a chaque tick, car il peut arriver jusqu'a 30 fois par seconde. Il est utilise pour l'etat temps reel et les snapshots envoyes a l'overlay.

Si SQLite ne demarre pas, le serveur continue quand meme a envoyer les donnees temps reel a l'overlay. Le stockage est desactive et l'erreur est affichee dans la console.
