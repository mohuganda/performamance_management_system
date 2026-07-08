package seeders

// Uganda district centroids for map visualisation (approximate administrative centres).
var ugandaDistricts = []struct {
	Code      string
	Name      string
	Region    string
	Latitude  float64
	Longitude float64
}{
	{Code: "KAMPALA", Name: "Kampala", Region: "Central", Latitude: 0.3476, Longitude: 32.5825},
	{Code: "WAKISO", Name: "Wakiso", Region: "Central", Latitude: 0.4044, Longitude: 32.4594},
	{Code: "MUKONO", Name: "Mukono", Region: "Central", Latitude: 0.3533, Longitude: 32.7553},
	{Code: "KAYUNGA", Name: "Kayunga", Region: "Central", Latitude: 0.7754, Longitude: 32.8258},
	{Code: "MUBENDE", Name: "Mubende", Region: "Central", Latitude: 0.5575, Longitude: 31.3889},
	{Code: "MASAKA", Name: "Masaka", Region: "Central", Latitude: -0.3333, Longitude: 31.7333},
	{Code: "MPIGI", Name: "Mpigi", Region: "Central", Latitude: 0.2250, Longitude: 32.3136},
	{Code: "LUWERO", Name: "Luwero", Region: "Central", Latitude: 0.8492, Longitude: 32.4731},
	{Code: "JINJA", Name: "Jinja", Region: "Eastern", Latitude: 0.4244, Longitude: 33.2042},
	{Code: "MBALE", Name: "Mbale", Region: "Eastern", Latitude: 1.0827, Longitude: 34.1750},
	{Code: "SOROTI", Name: "Soroti", Region: "Eastern", Latitude: 1.7146, Longitude: 33.6111},
	{Code: "TORORO", Name: "Tororo", Region: "Eastern", Latitude: 0.6928, Longitude: 34.1814},
	{Code: "IGANGA", Name: "Iganga", Region: "Eastern", Latitude: 0.6092, Longitude: 33.4686},
	{Code: "MBARARA", Name: "Mbarara", Region: "Western", Latitude: -0.6047, Longitude: 30.6486},
	{Code: "FORT PORTAL", Name: "Fort Portal", Region: "Western", Latitude: 0.6710, Longitude: 30.2750},
	{Code: "KASESE", Name: "Kasese", Region: "Western", Latitude: 0.1833, Longitude: 30.0833},
	{Code: "KABALE", Name: "Kabale", Region: "Western", Latitude: -1.2486, Longitude: 29.9897},
	{Code: "HOIMA", Name: "Hoima", Region: "Western", Latitude: 1.4319, Longitude: 31.3524},
	{Code: "GULU", Name: "Gulu", Region: "Northern", Latitude: 2.7746, Longitude: 32.2980},
	{Code: "LIRA", Name: "Lira", Region: "Northern", Latitude: 2.2499, Longitude: 32.8998},
	{Code: "ARUA", Name: "Arua", Region: "Northern", Latitude: 3.0201, Longitude: 30.9111},
	{Code: "KITGUM", Name: "Kitgum", Region: "Northern", Latitude: 3.2783, Longitude: 32.8861},
	{Code: "MOROTO", Name: "Moroto", Region: "Northern", Latitude: 2.5340, Longitude: 34.6667},
	{Code: "YUMBE", Name: "Yumbe", Region: "Northern", Latitude: 3.4650, Longitude: 31.2469},
	{Code: "ADJUMANI", Name: "Adjumani", Region: "Northern", Latitude: 3.3778, Longitude: 31.7909},
	{Code: "KOTIDO", Name: "Kotido", Region: "Northern", Latitude: 2.9806, Longitude: 34.1330},
	{Code: "PADER", Name: "Pader", Region: "Northern", Latitude: 2.8536, Longitude: 33.0750},
	{Code: "APAC", Name: "Apac", Region: "Northern", Latitude: 1.9756, Longitude: 32.5386},
	{Code: "KAMULI", Name: "Kamuli", Region: "Eastern", Latitude: 0.9472, Longitude: 33.1197},
	{Code: "PALLISA", Name: "Pallisa", Region: "Eastern", Latitude: 1.1450, Longitude: 33.7094},
	{Code: "KABERAMAIDO", Name: "Kaberamaido", Region: "Eastern", Latitude: 1.7389, Longitude: 33.2286},
	{Code: "BUSHENYI", Name: "Bushenyi", Region: "Western", Latitude: -0.5369, Longitude: 30.1869},
	{Code: "NTUNGAMO", Name: "Ntungamo", Region: "Western", Latitude: -0.8794, Longitude: 30.2642},
	{Code: "RUKUNGIRI", Name: "Rukungiri", Region: "Western", Latitude: -0.8417, Longitude: 29.9417},
	{Code: "KISORO", Name: "Kisoro", Region: "Western", Latitude: -1.2853, Longitude: 29.6847},
}
