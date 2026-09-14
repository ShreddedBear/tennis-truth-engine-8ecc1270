# Tennis-Data.co.uk WTA historical match results

Source: https://www.tennis-data.co.uk/alldata.php

Tennis-Data states that its historical ATP/WTA results and odds files are free to use. The WTA archive exposed by the source begins in 2007. This repository intentionally imports WTA seasons 2007 through 2016 only from this source.

## Audit use
- Historical WTA match identity/result evidence
- Tournament, date, surface, court, round and tier when explicitly present
- Historical winner/loser rankings when explicitly present
- Set-level score/result evidence when explicitly present
- Historical surface/match/set aggregates reconstructed from those rows

## Non-overlap rule
This archive ends at 2016. The current PredixSport WTA layer begins in 2017 and is ratings history rather than match-result rows. Every Tennis-Data row also has a canonical `match_key` built from date + tournament + round + unordered player pair. The sync refuses conflicting duplicate keys, so an overlapping future match source cannot silently award a player two wins for the same match.

## Source limitation
Tennis-Data.co.uk does not expose WTA 2005 or 2006 season archives on its all-data page. Those years are not fabricated or silently sourced elsewhere by this sync.
