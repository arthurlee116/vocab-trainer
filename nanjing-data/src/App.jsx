function App() {
  const data = [
    { district: '玄武区', population: 53.69, area: 75.46, density: 7115 },
    { district: '秦淮区', population: 74.29, area: 49.11, density: 15127 },
    { district: '建邺区', population: 54.93, area: 81.75, density: 6719 },
    { district: '鼓楼区', population: 94.27, area: 54.18, density: 17399 },
    { district: '浦口区', population: 41.45, area: 697.61, density: 594 },
    { district: '栖霞区', population: 101.27, area: 395.44, density: 2561 },
    { district: '雨花台区', population: 62.80, area: 132.39, density: 4744 },
    { district: '江宁区', population: 198.52, area: 1563.33, density: 1270 },
    { district: '六合区', population: 64.08, area: 1295.27, density: 495 },
    { district: '溧水区', population: 51.30, area: 1063.67, density: 482 },
    { district: '高淳区', population: 44.00, area: 790.22, density: 557 },
    { district: '江北新区直管区', population: 114.10, area: 388.61, density: 2936 },
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <table style={{ borderCollapse: 'collapse', border: '1px solid black' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '8px' }}>行政区</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>常住人口（万人）</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>土地面积（平方千米）</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>人口密度（人/平方千米）</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td style={{ border: '1px solid black', padding: '8px' }}>{row.district}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{row.population}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{row.area}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{row.density.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
