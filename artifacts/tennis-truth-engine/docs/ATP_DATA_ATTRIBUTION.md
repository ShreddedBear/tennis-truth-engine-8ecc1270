# ATP historical data attribution

ATP Main and ATP Challenger historical match ingestion uses the Jeff Sackmann / Tennis Abstract `tennis_atp` dataset.

Source: https://github.com/JeffSackmann/tennis_atp
License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

Attribution: Tennis databases, files, and algorithms by Jeff Sackmann / Tennis Abstract.

This integration is intended only for the app's current non-commercial/free use. Do not use this dataset in a commercial or monetized version without replacing it with a commercially permitted source or obtaining appropriate permission.

Tour separation:
- ATP Main reads `atp_matches_<year>.csv` and rejects Challenger (`tourney_level=C`) records.
- ATP Challenger reads `atp_matches_qual_chall_<year>.csv` and accepts only Challenger (`tourney_level=C`) records, preventing ATP qualifying rows from contaminating the Challenger dataset.
