// Просмотрщик модели полости рта: подсветка зоны случая, мишень на поражении,
// режимы «обычно» и «прозрачно» (губы и щёки насквозь).
// Имена частей — по разделу «3D: договорённость об именах» в CLAUDE.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Наружные мягкие ткани: в прозрачном режиме сквозь них видно, что внутри.
const OBOLOCHKA = /^(guba_|shcheka_)/;
const SKVOZ = 0.22; // непрозрачность оболочки в режиме «прозрачно»
const PODSVETKA = new THREE.Color(0xffb347);
const VPERED = new THREE.Vector3(0, 0.25, 1);
// Зубы мудрости и их десна достроены (у основы их нет): видны, только если зуб назвал случай.
const MUDROST = /^(zub|desna)_(\d8)$/;
// Глотка у основы свисает ниже подбородка: всё, что ниже этой высоты, не рисуем.
const GLOTKA_NIZ = -0.042;
// Части, которые видны, только если случай назвал их в obekty.
const PO_VYZOVU = ['protez'];
// Слизистая целиком — для поля tkani (сухость при ксеростомии).
export const SLIZISTAYA = ['desna_verh', 'desna_niz', 'yazyk', 'nebo', 'dno_rta', 'glotka',
  'shcheka_lev', 'shcheka_prav', 'guba_verh_vnutr', 'guba_niz_vnutr'];

const NAZVANIYA = {
  desna_verh: 'Десна верхняя', desna_niz: 'Десна нижняя', yazyk: 'Язык', nebo: 'Нёбо',
  dno_rta: 'Дно полости рта', glotka: 'Глотка',
  shcheka_lev: 'Щека левая', shcheka_prav: 'Щека правая',
  guba_verh: 'Верхняя губа', guba_niz: 'Нижняя губа',
  guba_verh_kayma: 'Верхняя губа — красная кайма', guba_niz_kayma: 'Нижняя губа — красная кайма',
  guba_verh_vnutr: 'Верхняя губа изнутри', guba_niz_vnutr: 'Нижняя губа изнутри',
  protez: 'Съёмный протез',
};

export function nazvanie(imya) {
  if (/^zub_\d\d$/.test(imya)) return 'Зуб ' + imya.slice(4);
  if (/^desna_\d8$/.test(imya)) return 'Десна вокруг зуба ' + imya.slice(6);
  if (imya.startsWith('porazh_')) return 'Поражение';
  return NAZVANIYA[imya] || imya;
}

// Что показывать в случае (по «Данным осмотра»): obekty — подсвеченные части, porazh — префикс накладок,
// skryt — спрятать части (удалённый зуб), formy — включить формы (отёк щеки: otyok_prav_niz),
// tkani — изменить вид слизистой: [{ chasti, umnozhit: [r, g, b], sherohovatost, gladko }];
// chasti — имена или префиксы частей (у накладок porazh_ меняется только цвет), gladko — без рельефа;
// napr — откуда смотреть на поражения [x, y, z] (y — вверх, z — к зрителю), если они разбросаны по рту;
// blizhe — доля обычной дальности камеры, если поражение мелкое, а накладки раскиданы широко;
// naskvoz — какие части в режиме «прозрачно» тоже насквозь, как губы и щёки (закрывают поражение).
// нёбо тоже: непрозрачное, оно складками закрывает спинку языка при взгляде сверху
const VERHNYAYA_CHELYUST = ['desna_verh', 'nebo', ...[1, 2].flatMap((k) => [1, 2, 3, 4, 5, 6, 7].map((n) => `zub_${k}${n}`))];
export const SLUCHAI = {
  // 1 и 4: поражения на обеих щеках — их нормали гасят друг друга, направление взгляда задано
  // в 1 язык сверху закрыт верхними зубами — как в 10, верхняя челюсть в «прозрачно» насквозь;
  // язык не подсвечиваем: на оранжевом белый налёт теряется
  1: { obekty: ['shcheka_lev', 'shcheka_prav', 'nebo'], porazh: 'porazh_01', napr: [0, 0.6, 1],
    naskvoz: VERHNYAYA_CHELYUST },
  2:{ obekty: ['guba_niz_vnutr', 'shcheka_lev'], porazh: 'porazh_02' },
  3: { obekty: ['guba_verh_kayma'], porazh: 'porazh_03' },
  4: { obekty: ['shcheka_lev', 'shcheka_prav'], porazh: 'porazh_04', napr: [0, 0.1, 1] },
  5: { obekty: ['protez', 'shcheka_lev'], porazh: 'porazh_05', skryt: ['zub_35', 'zub_36', 'zub_37'] },
  6: { porazh: 'porazh_06', tkani: [{ chasti: SLIZISTAYA, umnozhit: [0.97, 0.9, 0.9], sherohovatost: 0.85 }] },
  7: { obekty: ['yazyk'], porazh: 'porazh_07' },
  8: { obekty: ['desna_verh', 'desna_niz'], porazh: 'porazh_08' },
  9: { obekty: ['zub_38'], porazh: 'porazh_09' },
  // язык не подсвечиваем: подсветка красит его в оранжевый и прячет малиновый «лакированный» цвет
  10: { porazh: 'porazh_10', napr: [0, 0.6, 1], naskvoz: VERHNYAYA_CHELYUST,
    tkani: [{ chasti: ['yazyk', 'porazh_10_pyatno'], umnozhit: [1, 0.72, 0.72], sherohovatost: 0.15, gladko: true }] },
  // 11: валик и сосочки в пару миллиметров — с дальности обеих челюстей их не отличить от здоровой десны
  11: { obekty: ['desna_verh', 'desna_niz'], porazh: 'porazh_11', napr: [0, 0, 1], blizhe: 0.6 },
  // 12, 13, 16: нижние жевательные зубы сверху закрыты верхними — верхняя челюсть в «прозрачно» насквозь
  12: { porazh: 'porazh_12', skryt: ['zub_47'], naskvoz: VERHNYAYA_CHELYUST },
  13: { obekty: ['zub_36'], porazh: 'porazh_13', naskvoz: VERHNYAYA_CHELYUST },
  14: { obekty: ['guba_verh_vnutr'], porazh: 'porazh_14' },
  15: { obekty: ['guba_niz_kayma'], porazh: 'porazh_15' },
  16: { obekty: ['zub_46'], porazh: 'porazh_16', naskvoz: VERHNYAYA_CHELYUST },
  // как в 1: язык сверху закрыт верхними зубами, не подсвечиваем — на оранжевом белый налёт теряется
  17: { porazh: 'porazh_17', napr: [0, 0.6, 1], naskvoz: VERHNYAYA_CHELYUST },
};

/** Средняя нормаль поверхностей объектов в мировых координатах (куда «смотрит» поражение). */
function sredNormal(obekty) {
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  const m3 = new THREE.Matrix3();
  for (const o of obekty) {
    o.traverse((m) => {
      const a = m.isMesh && m.geometry.attributes.normal;
      if (!a) return;
      m3.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < a.count; i++) n.add(v.fromBufferAttribute(a, i).applyMatrix3(m3).normalize());
    });
  }
  return n.lengthSq() ? n.normalize() : n;
}

function vidimyy(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export class Prosmotr {
  static async sozdat(konteyner, put) {
    const p = new Prosmotr(konteyner);
    await p.zagruzit(put);
    return p;
  }

  constructor(konteyner) {
    this.konteyner = konteyner;
    this.onVybor = null;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    konteyner.appendChild(r.domElement);

    this.scena = new THREE.Scene();
    this.kamera = new THREE.PerspectiveCamera(35, 1, 0.005, 2);
    this.scena.add(this.kamera);
    this.scena.add(new THREE.HemisphereLight(0xffffff, 0x9a7f7f, 1.8));
    const svet = new THREE.DirectionalLight(0xffffff, 2.0);
    svet.position.set(0.2, 0.4, 1);
    this.kamera.add(svet); // свет от зрителя: видимая сторона всегда освещена

    this.upr = new OrbitControls(this.kamera, r.domElement);
    this.upr.enableDamping = true;
    this.upr.minDistance = 0.05;
    this.upr.maxDistance = 0.45;
    // модель — вырезанный кусок головы: сверху, снизу и сзади видна изнанка, туда камеру не пускаем
    const grad = THREE.MathUtils.degToRad;
    Object.assign(this.upr, { minPolarAngle: grad(45), maxPolarAngle: grad(125), minAzimuthAngle: grad(-100), maxAzimuthAngle: grad(100) });

    this.rezhimTek = 'obychno';
    this.formy = [];
    this.zona = [];
    this.podsvetkaVkl = true;
    this.naskvoz = [];
    this.porazheniya = [];
    this.misheni = new THREE.Group();
    this.scena.add(this.misheni);
    this.polet = null;

    this.ukazatel(r.domElement);
    new ResizeObserver(() => this.razmer()).observe(konteyner);
    this.razmer();
    // модель за краем экрана или на скрытой вкладке не рисуем — бережём батарею телефона
    new IntersectionObserver(([e]) => r.setAnimationLoop(e.isIntersecting ? (t) => this.kadr(t) : null)).observe(konteyner);
  }

  async zagruzit(put) {
    const gltf = await new GLTFLoader().loadAsync(put);
    this.model = gltf.scene;
    this.chasti = new Map(); // имя части → узел; у части из двух материалов меши внутри узла
    this.model.traverse((o) => {
      if (o.name && gltf.parser.associations.get(o)?.nodes !== undefined) this.chasti.set(o.name, o);
    });
    const setki = [];
    this.model.traverse((m) => m.isMesh && setki.push(m));
    for (const m of setki) {
      m.userData.chast = this.chastDlya(m);
      m.material = m.material.clone(); // у каждой части свой материал — подсвечиваем по отдельности
      const mt = m.material;
      m.userData.ishodnik = { color: mt.color.clone(), roughness: mt.roughness, roughnessMap: mt.roughnessMap, normalMap: mt.normalMap };
      if (m.userData.chast.startsWith('porazh_')) {
        Object.assign(m.material, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      }
      if (OBOLOCHKA.test(m.userData.chast)) this.sGlubinoy(m);
    }
    for (const [imya, o] of this.chasti) {
      if (imya.startsWith('porazh_') || MUDROST.test(imya) || PO_VYZOVU.includes(imya)) o.visible = false;
    }
    this.renderer.localClippingEnabled = true;
    const srez = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -GLOTKA_NIZ)];
    for (const m of this.setki('glotka')) m.material.clippingPlanes = srez;
    this.scena.add(this.model);
    const sfera = new THREE.Box3().setFromObject(this.model).getBoundingSphere(new THREE.Sphere());
    this.centr = sfera.center;
    this.R = sfera.radius;
    this.obzor(false);
  }

  /** В режиме «прозрачно» часть рисуется в два прохода: сначала только глубина, потом цвет
   *  ближайшего слоя. Так сквозь губы и щёки просвечивает один слой и кожа везде одного тона. */
  sGlubinoy(m) {
    // transparent — в общий прозрачный проход после накладок с прозрачным краем (renderOrder 0), иначе глубина губы
    // закроет их раньше, чем они нарисуются
    const glubina = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ colorWrite: false, side: m.material.side, transparent: true, depthWrite: true }));
    glubina.renderOrder = 5;
    glubina.visible = false;
    glubina.raycast = () => {};
    glubina.userData.sluzhebnyy = true;
    if (m.morphTargetInfluences) glubina.morphTargetInfluences = m.morphTargetInfluences; // отёк — и в проходе глубины
    m.add(glubina);
    m.userData.glubina = glubina;
  }

  chastDlya(o) {
    while (o && !this.chasti.has(o.name)) o = o.parent;
    return o ? o.name : '';
  }

  setki(imya) {
    const out = [];
    this.chasti.get(imya)?.traverse((m) => m.isMesh && !m.userData.sluzhebnyy && out.push(m));
    return out;
  }

  /** Показать случай: подсветить части obekty, включить накладки с префиксом porazh, спрятать части skryt,
   *  включить формы formy, изменить вид тканей tkani и навести камеру. */
  pokazat({ obekty = [], porazh = '', skryt = [], formy = [], tkani = [], napr = null, blizhe = 1, naskvoz = [] } = {}) {
    this.napr = napr;
    this.blizhe = blizhe;
    this.naskvoz = naskvoz;
    for (const m of this.zona) m.material.emissive.setRGB(0, 0, 0);
    // кожу и срез не подсвечиваем: зона — слизистая, а кожа должна быть одного цвета
    this.zona = obekty.flatMap((imya) => this.setki(imya)).filter((m) => !/^(kozha|srez)/.test(m.material.name));
    this.porazheniya = [];
    for (const [imya, o] of this.chasti) {
      if (imya.startsWith('porazh_')) {
        o.visible = porazh !== '' && imya.startsWith(porazh + '_');
        if (o.visible) this.porazheniya.push(o);
        continue;
      }
      const m = MUDROST.exec(imya);
      o.visible = !skryt.includes(imya) && (!m || obekty.includes('zub_' + m[2]) || obekty.includes(imya))
        && (!PO_VYZOVU.includes(imya) || obekty.includes(imya));
    }
    this.vidTkaney(tkani);
    this.formy = formy;
    this.nomer = -1;
    this.model.traverse((m) => {
      if (!m.morphTargetDictionary || m.userData.sluzhebnyy) return;
      m.morphTargetInfluences.fill(0);
      for (const f of formy) if (f in m.morphTargetDictionary) m.morphTargetInfluences[m.morphTargetDictionary[f]] = 1;
    });
    this.misheni.clear();
    const radius = (s) => Math.min(s.radius * 1.7, s.radius + 0.004); // у крупных (лунка) кольцо не на пол-экрана
    const sfery = this.porazheniya.map((o) => new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()));
    // кольца, которые налезали бы друг на друга (пятна на соседних зубах), — одно общее
    const obshchie = new Set();
    for (let i = 0; i < sfery.length; i++) {
      for (let j = i + 1; j < sfery.length; j++) {
        if (sfery[i].center.distanceTo(sfery[j].center) < 1.25 * (radius(sfery[i]) + radius(sfery[j]))) {
          sfery[i].union(sfery[j]);
          sfery.splice(j, 1);
          obshchie.add(sfery[i]);
          i = -1;
          break;
        }
      }
    }
    for (const s of sfery) {
      const r = obshchie.has(s) ? s.radius * 1.08 : radius(s); // общее — вплотную вокруг группы
      const m = new THREE.Mesh(
        new THREE.RingGeometry(1, 1 + Math.min(0.22, 0.0011 / r), 64), // толщина ~1 мм и у большого кольца
        new THREE.MeshBasicMaterial({ color: 0x0fa596, transparent: true, depthTest: false, side: THREE.DoubleSide }),
      );
      m.position.copy(s.center);
      m.userData.r = r;
      m.renderOrder = 10;
      this.misheni.add(m);
    }
    this.primenit();
    this.kZone();
  }

  /** Вид тканей случая (см. tkani у SLUCHAI); прежний случай сбрасывается к исходным материалам. */
  vidTkaney(tkani) {
    this.model.traverse((m) => {
      const s = m.userData.ishodnik;
      if (!s) return;
      const mt = m.material;
      const chast = m.userData.chast;
      const t = tkani.find((t) => t.chasti.some((c) => chast === c || chast.startsWith(c + '_')));
      const nakl = chast.startsWith('porazh_');
      const sliz = mt.name.startsWith('slizistaya');
      mt.color.copy(s.color);
      if (t?.umnozhit && (nakl || sliz)) mt.color.multiply(new THREE.Color(...t.umnozhit));
      const menyat = t && sliz && !nakl;
      mt.roughness = menyat && t.sherohovatost !== undefined ? t.sherohovatost : s.roughness;
      mt.roughnessMap = menyat && t.sherohovatost !== undefined ? null : s.roughnessMap;
      mt.normalMap = menyat && t.gladko ? null : s.normalMap;
      mt.needsUpdate = true;
    });
  }

  /** Режим: 'obychno' или 'prozrachno'. */
  rezhim(imya) {
    this.rezhimTek = imya;
    this.primenit();
  }

  primenit() {
    const prozr = this.rezhimTek === 'prozrachno';
    this.model.traverse((m) => {
      if (!m.isMesh || m.userData.sluzhebnyy) return;
      const skvoz = prozr && (OBOLOCHKA.test(m.userData.chast) || this.naskvoz.includes(m.userData.chast));
      if (!skvoz && !m.userData.glubina) return;
      if (!m.userData.glubina) this.sGlubinoy(m);
      m.userData.glubina.visible = skvoz;
      m.material.transparent = skvoz;
      m.material.opacity = skvoz ? SKVOZ : 1;
      m.material.depthWrite = !skvoz;
      m.renderOrder = skvoz ? 6 : 0;
      m.material.needsUpdate = true;
    });
  }

  /** Жёлтое свечение подсвеченных частей: vkl = false — выключить (цвет ткани виден как есть). */
  podsvetka(vkl) {
    this.podsvetkaVkl = vkl;
    if (!vkl) for (const m of this.zona) m.material.emissive.setRGB(0, 0, 0);
  }

  dalnost(radius) {
    const v = THREE.MathUtils.degToRad(this.kamera.fov);
    const g = 2 * Math.atan(Math.tan(v / 2) * this.kamera.aspect);
    return radius / Math.sin(Math.min(v, g) / 2);
  }

  letet(kuda, cel, plavno = true) {
    if (!plavno) {
      this.kamera.position.copy(kuda);
      this.upr.target.copy(cel);
      return;
    }
    this.polet = { ot: this.kamera.position.clone(), do: kuda, cel0: this.upr.target.clone(), cel };
  }

  /** Камера к поражению (или к подсвеченным частям; при отёке — всё лицо). ob — только эти поражения. */
  kZone(ob = null) {
    const odno = ob?.length === 1;
    ob ??= this.porazheniya.length ? this.porazheniya : this.zona;
    if (!ob.length) return this.obzor();
    const box = new THREE.Box3();
    ob.forEach((o) => box.expandByObject(o));
    const s = box.getBoundingSphere(new THREE.Sphere());
    // отёк виден по силуэту щеки: всё лицо спереди, чуть со здоровой стороны — отёчная щека видна контуром
    if (this.formy.length) return this.obzor(true, -0.2 * Math.sign(s.center.x - this.centr.x));
    const nap = s.center.clone().sub(this.centr).normalize().add(VPERED);
    // поражение, обращённое к зрителю или вверх (жевательная поверхность, лунка), — смотреть ему «в лицо»
    const n = sredNormal(this.porazheniya.includes(ob[0]) ? ob : this.porazheniya);
    if (n.dot(VPERED) > 0.2) nap.addScaledVector(n, 1.5);
    if (this.napr && !odno) nap.set(...this.napr);
    nap.normalize();
    // одно мелкое поражение (афта) — крупным планом, иначе на телефоне это точка
    const d = THREE.MathUtils.clamp(this.dalnost(Math.max(s.radius, 0.012) * 2.3) * this.blizhe, odno ? 0.07 : 0.11, 0.3);
    this.letet(s.center.clone().addScaledVector(nap, d), s.center.clone());
  }

  /** К следующему поражению по кругу, каждое крупным планом. Возвращает { nomer, vsego } или null. */
  kSleduyushchemu() {
    // сосочки десны (8) и валики (11) — десятки кусков одного поражения, их показывает общий вид
    if (this.porazheniya.length < 2 || this.porazheniya.length > 6 || this.formy.length) {
      this.kZone();
      return null;
    }
    this.nomer = (this.nomer + 1) % this.porazheniya.length;
    this.kZone([this.porazheniya[this.nomer]]);
    return { nomer: this.nomer + 1, vsego: this.porazheniya.length };
  }

  /** Вся модель спереди; povorot — доворот вбок (x направления взгляда: + к левой стороне пациента). */
  obzor(plavno = true, povorot = 0) {
    // вписать по ширине и высоте рамки модели: сфера вокруг глубокой модели (от губ до глотки) даёт слишком мелкий вид
    // глотку — только до среза, иначе её невидимый хвост раздувает кадр вниз
    const box = new THREE.Box3();
    for (const [imya, o] of this.chasti) if (imya !== 'glotka') box.expandByObject(o);
    const glotka = this.chasti.get('glotka');
    if (glotka) {
      const g = new THREE.Box3().setFromObject(glotka);
      g.min.y = Math.max(g.min.y, GLOTKA_NIZ);
      box.union(g);
    }
    const raz = box.getSize(new THREE.Vector3());
    const v = THREE.MathUtils.degToRad(this.kamera.fov) / 2;
    const g = Math.atan(Math.tan(v) * this.kamera.aspect);
    const d = Math.max(raz.y / 2 / Math.tan(v), raz.x / 2 / Math.tan(g)) * 1.12 + raz.z / 2;
    const c = box.getCenter(new THREE.Vector3());
    const nap = new THREE.Vector3(povorot, 0.1, 1).normalize();
    this.letet(c.clone().addScaledVector(nap, d), c, plavno);
  }

  kadr(t) {
    if (this.polet) {
      const p = this.polet;
      p.t0 ??= t;
      const k = Math.min(1, (t - p.t0) / 800);
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (2 - 2 * k) ** 3 / 2;
      this.kamera.position.lerpVectors(p.ot, p.do, e);
      this.upr.target.lerpVectors(p.cel0, p.cel, e);
      if (k === 1) this.polet = null;
    }
    this.upr.update();
    const puls = 0.5 + 0.5 * Math.sin(t / 260);
    for (const m of this.podsvetkaVkl ? this.zona : []) {
      m.material.emissive.copy(PODSVETKA);
      m.material.emissiveIntensity = 0.12 + 0.22 * puls;
    }
    for (const m of this.misheni.children) {
      m.quaternion.copy(this.kamera.quaternion);
      m.scale.setScalar(m.userData.r * (1 + 0.25 * puls));
      m.material.opacity = 0.95 - 0.5 * puls;
    }
    this.renderer.render(this.scena, this.kamera);
  }

  ukazatel(el) {
    let x0 = 0;
    let y0 = 0;
    el.addEventListener('pointerdown', (e) => {
      x0 = e.clientX;
      y0 = e.clientY;
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.model || Math.hypot(e.clientX - x0, e.clientY - y0) > 6) return;
      const r = el.getBoundingClientRect();
      const luch = new THREE.Raycaster();
      luch.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.kamera);
      const h = luch.intersectObject(this.model, true).find((h) => vidimyy(h.object) && this.vidno(h));
      this.onVybor?.(h ? h.object.userData.chast : '');
    });
  }

  vidno(h) {
    return !(this.rezhimTek === 'prozrachno' && h.object.material.transparent);
  }

  razmer() {
    const w = this.konteyner.clientWidth;
    const h = this.konteyner.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h;
    this.kamera.updateProjectionMatrix();
  }
}
