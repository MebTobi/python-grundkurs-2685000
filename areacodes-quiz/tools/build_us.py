#!/usr/bin/env python3
"""Erzeugt data/us.js (USA) für das Vorwahl-Quiz.

Geometrie-Quelle: "North America Telephone Area Code Boundaries" (UCLA Geoportal,
Stand 2015, Public Domain), aufbereitet unter https://github.com/1ec5/nanp-boundaries.
Aus dieser Quelle werden nur die geografischen Grundgebiete übernommen
(Dallas = 214, Houston = 281, da 972/713 dort deckungsgleich sind); Overlays (neue
Vorwahlen für dasselbe Gebiet) werden hier über die Tabelle CODES ihren
Grundgebieten zugeordnet, sodass auch Overlays nach 2015 enthalten sind.

Aufruf:
    python3 tools/build_us.py /pfad/zu/area-codes.geojson
Benötigt: npx mapshaper (npm i -g mapshaper)
"""
import sys
from common import build

# Format: Vorwahl|Staat|Grundgebiete (leer = eigenes Gebiet)|Städte
CODES = """
205|AL||Birmingham, Tuscaloosa, Hoover
659|AL|205|
251|AL||Mobile, Daphne
256|AL||Huntsville, Decatur, Gadsden
938|AL|256|
334|AL||Montgomery, Dothan, Auburn
907|AK||Anchorage, Fairbanks, Juneau
480|AZ||Mesa, Chandler, Scottsdale
520|AZ||Tucson, Sierra Vista
602|AZ||Phoenix
623|AZ||Glendale, Peoria, Surprise
928|AZ||Flagstaff, Yuma, Prescott
479|AR||Fort Smith, Fayetteville, Rogers
501|AR||Little Rock, Conway, Hot Springs
870|AR||Jonesboro, Pine Bluff, Texarkana
327|AR|870|
209|CA||Stockton, Modesto, Merced
350|CA|209|
213|CA|213,323|Los Angeles (Downtown)
323|CA|213,323|Los Angeles (Hollywood), Huntington Park, Montebello
738|CA|213,323|
310|CA||Santa Monica, Torrance, Beverly Hills
424|CA|310|
408|CA||San José, Sunnyvale, Santa Clara
669|CA|408|
415|CA||San Francisco, San Rafael
628|CA|415|
510|CA||Oakland, Berkeley, Fremont
341|CA|510|
530|CA||Redding, Chico, Davis
837|CA|530|
559|CA||Fresno, Visalia
562|CA||Long Beach, Norwalk, Whittier
619|CA||San Diego, Chula Vista, El Cajon
858|CA||San Diego (Nord), La Jolla, Poway
626|CA||Pasadena, El Monte, West Covina
650|CA||San Mateo, Palo Alto, Redwood City
661|CA||Bakersfield, Santa Clarita, Lancaster
707|CA||Santa Rosa, Vallejo, Eureka
369|CA|707|
714|CA||Anaheim, Santa Ana, Huntington Beach
657|CA|714|
760|CA||Oceanside, Palm Springs, Victorville
442|CA|760|
805|CA||Santa Barbara, Oxnard, San Luis Obispo
820|CA|805|
818|CA||Burbank, Glendale, San Fernando Valley
747|CA|818|
831|CA||Salinas, Santa Cruz, Monterey
909|CA||San Bernardino, Pomona, Ontario
840|CA|909|
916|CA||Sacramento, Roseville, Folsom
279|CA|916|
925|CA||Concord, Walnut Creek, Pleasanton
949|CA||Irvine, Newport Beach, Mission Viejo
951|CA||Riverside, Temecula, Corona
303|CO||Denver, Boulder, Aurora
720|CO|303|
983|CO|303|
719|CO||Colorado Springs, Pueblo
748|CO|719|
970|CO||Fort Collins, Grand Junction, Greeley
203|CT||New Haven, Bridgeport, Stamford
475|CT|203|
860|CT||Hartford, New London, Torrington
959|CT|860|
302|DE||Wilmington, Dover, Newark
202|DC||Washington
771|DC|202|
239|FL||Fort Myers, Naples, Cape Coral
305|FL||Miami, Hialeah, Key West
786|FL|305|
645|FL|305|
321|FL|321,407|Cocoa, Melbourne, Titusville
407|FL||Orlando, Kissimmee, Sanford
689|FL|407,321|
352|FL||Gainesville, Ocala
386|FL||Daytona Beach, Deltona, Lake City
561|FL||West Palm Beach, Boca Raton
728|FL|561|
727|FL||St. Petersburg, Clearwater
772|FL||Port St. Lucie, Vero Beach
813|FL||Tampa, Brandon
656|FL|813|
850|FL||Tallahassee, Pensacola, Panama City
448|FL|850|
863|FL||Lakeland, Winter Haven
904|FL||Jacksonville, St. Augustine
324|FL|904|
941|FL||Sarasota, Bradenton, Port Charlotte
954|FL||Fort Lauderdale, Hollywood, Pompano Beach
754|FL|954|
229|GA||Albany, Valdosta
404|GA||Atlanta
770|GA||Marietta, Roswell, Lawrenceville
470|GA|404,770|
678|GA|404,770|
943|GA|404,770|
478|GA||Macon, Warner Robins
706|GA||Augusta, Columbus, Athens
762|GA|706|
912|GA||Savannah, Brunswick
808|HI||Honolulu, Hilo, Kahului
208|ID||Boise, Idaho Falls, Pocatello
986|ID|208|
217|IL||Springfield, Champaign, Decatur
447|IL|217|
309|IL||Peoria, Bloomington, Moline
861|IL|309|
312|IL||Chicago (Loop)
773|IL||Chicago
872|IL|312,773|
630|IL||Naperville, Aurora, Wheaton
331|IL|630|
618|IL||Belleville, Carbondale, Alton
730|IL|618|
708|IL||Cicero, Oak Lawn, Orland Park
464|IL|708|
815|IL||Rockford, Joliet, DeKalb
779|IL|815|
847|IL||Evanston, Skokie, Schaumburg
224|IL|847|
219|IN||Gary, Hammond, Valparaiso
260|IN||Fort Wayne
317|IN||Indianapolis, Carmel
463|IN|317|
574|IN||South Bend, Elkhart
765|IN||Lafayette, Muncie, Kokomo
812|IN||Evansville, Bloomington, Columbus
930|IN|812|
319|IA||Cedar Rapids, Iowa City, Waterloo
515|IA||Des Moines, Ames
563|IA||Davenport, Dubuque
641|IA||Mason City, Ottumwa
712|IA||Sioux City, Council Bluffs
316|KS||Wichita
620|KS||Dodge City, Hutchinson, Garden City
785|KS||Topeka, Lawrence, Manhattan
913|KS||Kansas City, Overland Park, Olathe
270|KY||Bowling Green, Owensboro, Paducah
364|KY|270|
502|KY||Louisville, Frankfort
606|KY||Ashland, Hazard, Somerset
859|KY||Lexington, Covington
225|LA||Baton Rouge
318|LA||Shreveport, Monroe, Alexandria
337|LA||Lafayette, Lake Charles
504|LA||New Orleans, Metairie
985|LA||Houma, Hammond, Slidell
207|ME||Portland, Bangor, Augusta
301|MD||Silver Spring, Frederick, Hagerstown
240|MD|301|
227|MD|301|
410|MD||Baltimore, Annapolis, Salisbury
443|MD|410|
667|MD|410|
413|MA||Springfield, Pittsfield
508|MA||Worcester, New Bedford, Barnstable
774|MA|508|
617|MA||Boston, Cambridge, Quincy
857|MA|617|
781|MA||Lynn, Waltham, Woburn
339|MA|781|
978|MA||Lowell, Lawrence, Haverhill
351|MA|978|
231|MI||Muskegon, Traverse City
248|MI||Troy, Pontiac, Southfield
947|MI|248|
269|MI||Kalamazoo, Battle Creek
313|MI||Detroit, Dearborn
679|MI|313|
517|MI||Lansing, Jackson
586|MI||Warren, Sterling Heights
616|MI||Grand Rapids, Holland
734|MI||Ann Arbor, Livonia
810|MI||Flint, Port Huron
906|MI||Marquette, Sault Ste. Marie
989|MI||Saginaw, Bay City, Midland
218|MN||Duluth, Moorhead, Bemidji
320|MN||St. Cloud, Willmar
507|MN||Rochester, Mankato
612|MN||Minneapolis
651|MN||St. Paul
763|MN||Brooklyn Park, Plymouth, Coon Rapids
952|MN||Bloomington, Eden Prairie
228|MS||Gulfport, Biloxi
601|MS||Jackson, Hattiesburg, Meridian
769|MS|601|
662|MS||Tupelo, Oxford, Southaven
314|MO||St. Louis
557|MO|314|
417|MO||Springfield, Joplin
573|MO||Columbia, Jefferson City, Cape Girardeau
235|MO|573|
636|MO||St. Charles, O'Fallon
660|MO||Sedalia, Kirksville
816|MO||Kansas City, St. Joseph
975|MO|816|
406|MT||Billings, Missoula, Helena
308|NE||Grand Island, Kearney, North Platte
402|NE||Omaha, Lincoln
531|NE|402|
702|NV||Las Vegas, Henderson
725|NV|702|
775|NV||Reno, Carson City, Elko
603|NH||Manchester, Nashua, Concord
201|NJ||Jersey City, Hackensack, Bayonne
551|NJ|201|
609|NJ||Trenton, Atlantic City, Princeton
640|NJ|609|
732|NJ||New Brunswick, Toms River, Edison
848|NJ|732|
856|NJ||Camden, Cherry Hill, Vineland
908|NJ||Elizabeth, Plainfield, Somerville
973|NJ||Newark, Paterson, Morristown
862|NJ|973|
505|NM||Albuquerque, Santa Fe
575|NM||Las Cruces, Roswell
212|NY||Manhattan
646|NY|212|
332|NY|212|
718|NY||Brooklyn, Queens, Bronx, Staten Island
347|NY|718|
929|NY|718|
917|NY|212,718|New York City (Mobilfunk)
315|NY||Syracuse, Utica, Watertown
680|NY|315|
516|NY||Nassau County (Hempstead)
363|NY|516|
518|NY||Albany, Schenectady, Plattsburgh
838|NY|518|
585|NY||Rochester
607|NY||Binghamton, Ithaca, Elmira
631|NY||Suffolk County (Islip, Brookhaven)
934|NY|631|
716|NY||Buffalo, Niagara Falls
624|NY|716|
845|NY||Poughkeepsie, Newburgh
329|NY|845|
914|NY||Yonkers, White Plains, New Rochelle
252|NC||Greenville, Rocky Mount
336|NC||Greensboro, Winston-Salem
743|NC|336|
704|NC||Charlotte, Gastonia
980|NC|704|
828|NC||Asheville, Hickory
910|NC||Fayetteville, Wilmington
472|NC|910|
919|NC||Raleigh, Durham, Cary
984|NC|919|
701|ND||Fargo, Bismarck, Grand Forks
216|OH||Cleveland
330|OH||Akron, Youngstown, Canton
234|OH|330|
419|OH||Toledo, Lima
567|OH|419|
440|OH||Parma, Lorain, Mentor
436|OH|440|
513|OH||Cincinnati, Hamilton
283|OH|513|
614|OH||Columbus
380|OH|614|
740|OH||Zanesville, Athens, Newark
220|OH|740|
937|OH||Dayton, Springfield
326|OH|937|
405|OK||Oklahoma City, Norman
572|OK|405|
580|OK||Lawton, Enid, Ardmore
918|OK||Tulsa, Muskogee
539|OK|918|
503|OR||Portland, Salem
971|OR|503|
541|OR||Eugene, Bend, Medford
458|OR|541|
215|PA||Philadelphia
267|PA|215|
445|PA|215|
412|PA||Pittsburgh
724|PA||Washington, New Castle, Greensburg
878|PA|412,724|
570|PA||Scranton, Wilkes-Barre
272|PA|570|
610|PA||Allentown, Reading
484|PA|610|
835|PA|610|
717|PA||Harrisburg, Lancaster, York
223|PA|717|
814|PA||Erie, Altoona, State College
582|PA|814|
401|RI||Providence, Warwick
803|SC||Columbia, Rock Hill
839|SC|803|
843|SC||Charleston, Myrtle Beach
854|SC|843|
864|SC||Greenville, Spartanburg
821|SC|864|
605|SD||Sioux Falls, Rapid City
423|TN||Chattanooga, Johnson City
615|TN||Nashville, Murfreesboro
629|TN|615|
731|TN||Jackson
865|TN||Knoxville
901|TN||Memphis
931|TN||Clarksville, Cookeville
210|TX||San Antonio
726|TX|210|
214|TX|214|Dallas
972|TX|214|Plano, Irving, Garland
469|TX|214|
945|TX|214|
254|TX||Waco, Killeen, Temple
713|TX|281|Houston
281|TX|281|Houston (Umland), Pasadena, Sugar Land
832|TX|281|
346|TX|281|
325|TX||Abilene, San Angelo
361|TX||Corpus Christi, Victoria
409|TX||Beaumont, Galveston, Port Arthur
432|TX||Midland, Odessa
512|TX||Austin
737|TX|512|
806|TX||Lubbock, Amarillo
817|TX||Fort Worth, Arlington
682|TX|817|
830|TX||New Braunfels, Del Rio, Kerrville
903|TX||Tyler, Texarkana, Longview
430|TX|903|
915|TX||El Paso
936|TX||Huntsville, Lufkin, Conroe
940|TX||Denton, Wichita Falls
956|TX||Laredo, Brownsville, McAllen
979|TX||College Station, Bay City
801|UT||Salt Lake City, Provo, Ogden
385|UT|801|
435|UT||St. George, Logan, Moab
802|VT||Burlington, Montpelier
276|VA||Bristol, Martinsville
434|VA||Lynchburg, Charlottesville, Danville
540|VA||Roanoke, Fredericksburg, Winchester
826|VA|540|
703|VA||Arlington, Alexandria, Fairfax
571|VA|703|
757|VA||Norfolk, Virginia Beach, Newport News
948|VA|757|
804|VA||Richmond, Petersburg
686|VA|804|
206|WA||Seattle
253|WA||Tacoma, Kent
360|WA||Vancouver, Olympia, Bellingham
564|WA|360|
425|WA||Bellevue, Everett, Redmond
509|WA||Spokane, Yakima, Kennewick
304|WV||Charleston, Huntington, Morgantown
681|WV|304|
262|WI||Kenosha, Racine, Waukesha
414|WI||Milwaukee
608|WI||Madison, La Crosse
353|WI|608|
715|WI||Eau Claire, Wausau
534|WI|715|
920|WI||Green Bay, Appleton, Oshkosh
274|WI|920|
307|WY||Cheyenne, Casper
787|PR||San Juan, Bayamón, Ponce
939|PR|787|
340|VI||Charlotte Amalie, Christiansted
671|GU||Hagåtña, Dededo
670|MP||Saipan
684|AS||Pago Pago
"""

STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "Kalifornien", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "DC": "Washington, D.C.", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "PR": "Puerto Rico",
    "VI": "Amerikanische Jungferninseln", "GU": "Guam", "MP": "Nördliche Marianen",
    "AS": "Amerikanisch-Samoa",
}


def parse_codes():
    codes = {}
    for line in CODES.strip().splitlines():
        code, state, bases, cities = line.split("|")
        assert code not in codes, code
        codes[code] = {
            "s": state,
            "b": bases.split(",") if bases else [code],
            "c": [c.strip() for c in cities.split(",") if c.strip()],
        }
    # Overlays erben die Städte ihrer Grundgebiete
    for code, info in codes.items():
        if not info["c"]:
            seen = []
            for b in info["b"]:
                for c in codes[b]["c"]:
                    if c not in seen:
                        seen.append(c)
            info["c"] = seen[:4]
    return codes


def main(src):
    codes = parse_codes()
    bases = {b for i in codes.values() for b in i["b"]}
    build(cc="us", src=[src], assign_field="NPA", assign={b: b for b in bases},
          codes=codes, groups=STATES,
          extra_cmds=["-filter", "COUNTRY == 'UNITED STATES'"],
          preclean=("-clean", "overlap-rule=min-area"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "area-codes.geojson")
