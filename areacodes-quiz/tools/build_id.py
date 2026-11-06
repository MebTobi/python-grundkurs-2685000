#!/usr/bin/env python3
"""Erzeugt data/id.js (Indonesien) für das Vorwahl-Quiz.

Geometrie: Batas Kabupaten/Kota 2020 (Kemendagri/BIG), bereitgestellt unter
https://github.com/Alf-Anas/batas-administrasi-indonesia ("2020/Batas Kabupaten SHP.zip").
Vorwahlen: eigene Zuordnungstabelle (unten), abgeglichen mit
https://github.com/Namchee/telepon (MIT).

Jede Kabupaten/Kota gehört genau zu einer Haupt-Vorwahl; deren Gebiete werden
zusammengefasst. Weitere Vorwahlen innerhalb eines Gebiets (z. B. 336 in Jember)
verweisen mit "@" auf das Gebiet der Haupt-Vorwahl.

Aufruf: python3 tools/build_id.py "/pfad/Batas Kabupaten.shp"   (benötigt npx mapshaper)
"""
import sys
from common import build

PROV = {
    "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau", "15": "Jambi",
    "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung", "19": "Kepulauan Bangka Belitung",
    "21": "Kepulauan Riau", "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah",
    "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten", "51": "Bali",
    "52": "Nusa Tenggara Barat", "53": "Nusa Tenggara Timur", "61": "Kalimantan Barat",
    "62": "Kalimantan Tengah", "63": "Kalimantan Selatan", "64": "Kalimantan Timur",
    "65": "Kalimantan Utara", "71": "Sulawesi Utara", "72": "Sulawesi Tengah",
    "73": "Sulawesi Selatan", "74": "Sulawesi Tenggara", "75": "Gorontalo", "76": "Sulawesi Barat",
    "81": "Maluku", "82": "Maluku Utara", "91": "Papua", "92": "Papua Barat",
    "93": "Papua Selatan", "94": "Papua Tengah", "95": "Papua Pegunungan", "96": "Papua Barat Daya",
}
# Neue Papua-Provinzen (2022): Kabupaten-Code -> Provinz
PAPUA = {
    **dict.fromkeys(["9201", "9204", "9205", "9209", "9210", "9271"], "96"),
    **dict.fromkeys(["9104", "9107", "9108", "9109", "9125", "9126", "9127", "9128"], "94"),
    **dict.fromkeys(["9102", "9112", "9113", "9114", "9121", "9122", "9123", "9124"], "95"),
    **dict.fromkeys(["9101", "9116", "9117", "9118"], "93"),
}

# Vorwahl (ohne 0) | Kabupaten/Kota-Codes oder @Haupt-Vorwahl | Orte
CODES = """
651|1171,1106|Banda Aceh, Jantho
652|1172|Sabang
653|1107,1118|Sigli, Meureudu
654|1114|Calang
655|1105,1115|Meulaboh, Suka Makmue
656|1101|Tapaktuan
657|@656|Bakongan
659|1112|Blangpidie
650|1109|Sinabang
658|1110|Singkil
629|1102|Kutacane
642|1113|Blangkejeren
643|1104,1117|Takengon, Simpang Tiga Redelong
644|1111|Bireuen
645|1173,1108|Lhokseumawe, Lhoksukon
646|1103|Idi Rayeuk
641|1174,1116|Langsa, Kuala Simpang
61|1271,1275,1207,1205|Medan, Binjai, Lubuk Pakam, Stabat
620|@61|Pangkalan Brandan
621|1276,1218|Tebing Tinggi, Sei Rampah
622|1272,1208,1219|Pematangsiantar, Limapuluh
623|1209,1274|Kisaran, Tanjung Balai
624|1210,1222,1223|Rantau Prapat, Kota Pinang, Aek Kanopan
625|@622|Parapat
626|1217|Pangururan
627|1211,1215,1175|Sidikalang, Salak, Subulussalam
628|1206|Kabanjahe, Berastagi
630|1214|Teluk Dalam
631|1201,1273|Sibolga, Pandan
632|1212|Balige
633|1202,1216|Tarutung, Dolok Sanggul
634|1277,1203|Padang Sidempuan, Sipirok
635|1220,1221|Gunung Tua, Sibuhuan
636|1213|Panyabungan
638|@631|Barus
639|1204,1278,1224,1225|Gunungsitoli
751|1371,1305,1377|Padang, Pariaman
752|1375,1306,1374,1304,1376,1307|Bukittinggi, Payakumbuh, Batusangkar, Padang Panjang
753|1308,1312|Lubuk Sikaping, Simpang Empat
754|1373,1303,1310|Sawahlunto, Muaro Sijunjung, Pulau Punjung
755|1302,1372,1311|Solok, Padang Aro
756|1301|Painan
757|@756|Balai Selasa
759|1309|Tuapejat
761|1471,1405|Pekanbaru, Pangkalan Kerinci
762|1401,1406|Bangkinang, Pasir Pengaraian
763|1410|Selatpanjang
764|1408|Siak Sri Indrapura
765|1472|Dumai, Duri
766|1403|Bengkalis
767|1407|Bagansiapiapi
768|1404|Tembilahan
769|1402|Rengat
760|1409|Teluk Kuantan
778|2171|Batam
770|@778|Muka Kuning
771|2172,2101|Tanjung Pinang, Bandar Seri Bentan
772|2105|Tarempa
773|2103|Ranai
776|2104|Dabo Singkep, Daik
777|2102|Tanjung Balai Karimun
779|@777|Tanjung Batu
741|1571,1505,1507|Jambi, Sengeti, Muara Sabak
742|1506|Kuala Tungkal
743|1504|Muara Bulian
744|1509|Muara Tebo
745|1503|Sarolangun
746|1502|Bangko
747|1508|Muara Bungo
748|1501,1572|Sungai Penuh, Siulak
711|1671,1610,1607|Palembang, Indralaya, Pangkalan Balai
712|1602|Kayu Agung
713|1674,1612|Prabumulih, Talang Ubi
714|1606|Sekayu
730|1672|Pagar Alam
731|1604|Lahat
702|1611|Tebing Tinggi
733|1673,1605,1613|Lubuklinggau, Muara Beliti, Rupit
734|1603|Muara Enim
735|1601,1608,1609|Baturaja, Martapura, Muaradua
717|1971,1901|Pangkal Pinang, Sungailiat
715|@717|Belinyu
716|1905|Muntok
718|1904,1903|Koba, Toboali
719|1902,1906|Tanjung Pandan, Manggar
736|1771,1705,1709|Bengkulu, Tais, Karang Tinggi
737|1703,1706|Arga Makmur, Mukomuko
739|1701,1704|Manna, Bintuhan
732|1702,1708,1707|Curup, Kepahiang, Muara Aman
721|1871,1809|Bandar Lampung, Gedong Tataan
722|1806|Kota Agung
723|1808|Blambangan Umpu
724|1803|Kotabumi
725|1872,1802,1807|Metro, Gunung Sugih, Sukadana
726|1805,1811,1812|Menggala, Mesuji, Tulang Bawang Tengah
727|1801|Kalianda
728|1804,1813|Liwa, Krui
729|1810|Pringsewu
21|3171,3172,3173,3174,3175,3101,3216,3275,3276,3603,3671,3674|Jakarta, Bekasi, Depok, Tangerang
251|3271,3201|Bogor, Cibinong
252|3602|Rangkasbitung
253|3601|Pandeglang
254|3604,3673,3672|Serang, Cilegon
22|3273,3204,3217,3277|Bandung, Cimahi, Soreang
231|3209,3274|Cirebon, Sumber
232|3208|Kuningan
233|3210|Majalengka
234|3212|Indramayu
260|3213|Subang
261|3211|Sumedang
262|3205|Garut
263|3203|Cianjur
264|3214|Purwakarta
265|3206,3278,3207,3279,3218|Tasikmalaya, Ciamis, Banjar, Pangandaran
266|3202,3272|Sukabumi, Pelabuhan Ratu
267|3215|Karawang
24|3374,3322|Semarang, Ungaran
298|3373|Salatiga
271|3372,3311,3313,3314|Surakarta, Sukoharjo, Karanganyar, Sragen
276|3309|Boyolali
272|3310|Klaten
273|3312|Wonogiri
275|3306|Purworejo
282|3301|Cilacap
280|@282|Majenang, Sidareja
281|3302,3303|Purwokerto, Purbalingga
283|3328,3376,3329|Tegal, Slawi, Brebes
289|@283|Bumiayu
284|3327|Pemalang
285|3326,3375,3325|Pekalongan, Batang, Kajen
286|3304,3307|Banjarnegara, Wonosobo
287|3305|Kebumen
291|3319,3320,3321|Kudus, Jepara, Demak
297|@291|Karimunjawa
292|3315|Purwodadi
293|3308,3371,3323|Magelang, Temanggung, Mungkid
294|3324|Kendal
295|3318,3317|Pati, Rembang
296|3316|Blora, Cepu
274|3401,3402,3403,3404,3471|Yogyakarta, Sleman, Bantul, Wonosari
31|3578,3525,3515,3526|Surabaya, Sidoarjo, Gresik, Bangkalan
325|@31|Bawean
321|3516,3576,3517|Mojokerto, Jombang
322|3524|Lamongan
323|3527|Sampang
324|3528|Pamekasan
328|3529|Sumenep
326|@328|Masalembu
327|@328|Kangean
331|3509|Jember
336|@331|Ambulu, Kencong
332|3511|Bondowoso
333|3510|Banyuwangi
334|3508|Lumajang
335|3513,3574|Probolinggo, Kraksaan
338|3512|Situbondo
341|3507,3573,3579|Malang, Batu, Kepanjen
342|3505,3572|Blitar
343|3514,3575|Pasuruan, Bangil
351|3519,3577,3520,3521|Madiun, Magetan, Ngawi
352|3502|Ponorogo
353|3522|Bojonegoro
354|3506,3571|Kediri
355|3504,3503|Tulungagung, Trenggalek
356|3523|Tuban
357|3501|Pacitan
358|3518|Nganjuk
361|5171,5103,5104,5102|Denpasar, Kuta, Gianyar, Tabanan
368|@361|Bedugul, Baturiti
362|5108|Singaraja
363|5107|Amlapura
365|5101|Negara
366|5105,5106|Semarapura, Bangli
370|5271,5201,5202,5208|Mataram, Gerung, Praya, Tanjung
376|5203|Selong
371|5204|Sumbawa Besar
372|5207|Taliwang
373|5205|Dompu
374|5206,5272|Bima
380|5301,5371,5314,5320|Kupang, Ba'a, Seba
379|5305|Kalabahi
381|5308|Ende
382|5307|Maumere
383|5306,5313|Larantuka, Lewoleba
384|5309,5316|Bajawa, Mbay
385|5310,5319|Ruteng, Borong
386|5315|Labuan Bajo
387|5311,5312,5317,5318|Waingapu, Waikabubak, Tambolaka
388|5302,5303|Soe, Kefamenanu
389|5304,5321|Atambua, Betun
561|6171,6112,6102|Pontianak, Sungai Raya, Mempawah
562|6101,6107,6172|Singkawang, Sambas, Bengkayang
563|6108|Ngabang
564|6103,6109|Sanggau, Sekadau
565|6105|Sintang
567|6106|Putussibau
568|6110|Nanga Pinoh
534|6104|Ketapang
535|6111|Sukadana
536|6271,6206|Palangka Raya, Kasongan
513|6203,6211|Kuala Kapuas, Pulang Pisau
519|6205|Muara Teweh
525|6204|Buntok
528|6212|Puruk Cahu
531|6202|Sampit
539|@531|Kuala Kuayan
532|6201,6208,6209|Pangkalan Bun, Sukamara, Nanga Bulik
537|6210|Kuala Kurun
538|6207|Kuala Pembuang
511|6371,6372,6303,6304|Banjarmasin, Banjarbaru, Martapura, Marabahan
512|6301|Pelaihari
517|6306,6307,6305|Kandangan, Barabai, Rantau
518|6302,6310|Kotabaru, Batulicin
526|6309,6311,6213|Tanjung, Paringin, Tamiang Layang
527|6308|Amuntai
541|6472,6402|Samarinda, Tenggarong
542|6471,6409|Balikpapan, Penajam
543|6401|Tanah Grogot
545|6407,6411|Sendawar, Long Bagun
548|6474|Bontang
549|6408|Sangatta
554|6403|Tanjung Redeb
551|6571|Tarakan
552|6501,6504|Tanjung Selor, Tideng Pale
553|6502|Malinau
556|6503|Nunukan
431|7171,7102,7106,7173|Manado, Tondano, Airmadidi, Tomohon
430|7105,7107|Amurang, Ratahan
432|7103,7109|Tahuna, Ondong Siau
433|7104|Melonguane
434|7101,7174,7110,7111,7108|Kotamobagu, Lolak, Boroko
438|7172|Bitung
435|7571,7501,7503,7505|Gorontalo, Limboto, Suwawa, Kwandang
443|7502,7504|Tilamuta, Marisa
451|7271,7203,7210|Palu, Donggala, Sigi Biromaru
450|7208|Parigi
452|7202|Poso
453|7204|Tolitoli
445|7205|Buol
461|7201|Luwuk
462|7207,7211|Salakan, Banggai
464|7209|Ampana
465|7212|Kolonodale
409|7206|Bungku
411|7371,7309,7306|Makassar, Maros, Sungguminasa
417|@411|Malino
410|7310|Pangkajene
418|7305|Takalar
419|7304|Jeneponto
413|7303,7302|Bulukumba, Bantaeng
414|7301|Benteng
420|7316|Enrekang
421|7372,7311,7315,7314|Parepare, Barru, Pinrang, Sidenreng
423|7318,7326|Makale, Rantepao
471|7373,7317|Palopo, Belopa
473|7322|Masamba
474|7324|Malili
481|7308|Watampone
482|7307|Sinjai
484|7312|Watansoppeng
485|7313|Sengkang
426|7602,7606,7601|Mamuju, Tobadak, Pasangkayu
422|7605|Majene
428|7604,7603|Polewali, Mamasa
401|7471,7402,7405,7409,7412,7406|Kendari, Unaaha, Andoolo, Rumbia
408|@401|Unaaha
402|7472,7404,7414,7415,7410|Baubau, Pasarwajo, Buranga
403|7403,7413|Raha, Laworo
404|7407|Wangi-Wangi
405|7401,7408,7411|Kolaka, Lasusua, Tirawuta
911|8171,8106|Ambon, Piru
914|8101|Masohi
910|@914|Banda Naira
913|8104,8109|Namlea, Namrole
915|8105|Bula
916|8172,8102|Tual, Langgur
917|8107|Dobo
918|8103,8108|Saumlaki, Tiakur
921|8271,8272,8201|Ternate, Tidore, Jailolo
920|8202,8206|Weda, Maba
924|8203,8207|Tobelo, Daruba
927|8204|Labuha
929|8205,8208|Sanana, Bobong
951|9271,9201,9205,9209,9210,9204|Sorong, Waisai, Teminabuan
986|9202,9211,9212,9207|Manokwari, Ransiki, Wasior
956|9203,9208|Fakfak, Kaimana
955|9206|Bintuni
967|9171,9103,9111|Jayapura, Sentani, Arso
966|9110,9120|Sarmi, Burmeso
969|9102,9123,9114,9122,9121,9124,9112,9113|Wamena, Tiom, Karubaga, Dekai
971|9101,9117|Merauke, Kepi
975|9116|Tanah Merah
902|9118|Agats
901|9109|Timika
979|@901|Tembagapura
984|9104,9126,9128,9108,9127,9125,9107|Nabire, Enarotali, Mulia
981|9106,9119|Biak, Sorendiweri
983|9105,9115|Serui, Botawa
"""


def prov_of(kab):
    return PAPUA.get(kab, kab[:2])


def main(shp):
    codes, assign = {}, {}
    rows = [l.split("|") for l in CODES.strip().splitlines()]
    for code, kabs, cities in rows:
        assert code not in codes, code
        cities = [c.strip() for c in cities.split(",")]
        if kabs.startswith("@"):
            codes[code] = {"ref": kabs[1:], "c": cities}
            continue
        kl = kabs.split(",")
        for k in kl:
            assert k not in assign, (k, code, assign.get(k))
            assign[k] = code
        codes[code] = {"s": prov_of(kl[0]), "b": [code], "c": cities}
    for code, info in codes.items():
        if "ref" in info:
            ref = codes[info.pop("ref")]
            info["s"] = ref["s"]
            info["b"] = list(ref["b"])
    build(
        cc="id", src=[shp], assign_field="Kode_Kab", assign=assign,
        codes=codes, groups={k: v for k, v in PROV.items()},
        extra_cmds=["-filter", "Kode_Kab != ''"], interval=400, strict="Kab_Kota",
    )


if __name__ == "__main__":
    main(sys.argv[1])
