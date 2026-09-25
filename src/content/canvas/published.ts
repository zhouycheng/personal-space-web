import type { MineCanvasDocument } from "../../components/mine-canvas/mineCanvasTypes";

// Published canvas content, revision 138.
export const mineCanvasSeed: MineCanvasDocument = {
  "version": 4,
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "nodes": [
    {
      "id": "node-monitor-1782561306641",
      "type": "mine",
      "position": {
        "x": 532.9665531882612,
        "y": 270.39725464626827
      },
      "data": {
        "kind": "monitor",
        "title": "我正在使用",
        "accent": "#059669",
        "width": 320,
        "height": 140
      },
      "style": {
        "width": 320,
        "height": 140
      }
    },
    {
      "id": "node-timeline-1782563332675",
      "type": "mine",
      "position": {
        "x": 516.0157258667899,
        "y": 519.2604691818574
      },
      "data": {
        "kind": "timeline",
        "title": "竞赛经历时间线",
        "accent": "#3f79d8",
        "width": 330,
        "height": 545,
        "items": [
          {
            "id": "time-1782567802731",
            "time": "2026.4",
            "title": "第 48 届世界技能大赛移动应用开发项目国家集训队 10 进 1 测试赛",
            "subtitle": "第 5 名，第 5 名，第 5 名",
            "color": "#3f79d8",
            "hollow": true
          },
          {
            "id": "time-1782567641128",
            "time": "2025.9",
            "title": "第三届中华人民共和国职业技能大赛的移动应用开发项目",
            "subtitle": "拿了优胜奖，进前十喽，进了第 48 届世界技能大赛的国家集训队",
            "color": "#3f79d8",
            "hollow": true
          },
          {
            "id": "time-1782567477291",
            "time": "2024.10 - 2025.9",
            "title": "在广州集训备赛了一整年",
            "subtitle": "备赛第三届中华人民共和国职业技能大赛的移动应用开发项目",
            "color": "#3f79d8",
            "hollow": true
          },
          {
            "id": "time-1782566183167",
            "time": "2024.9",
            "title": "第一次接触到移动应用开发相关的比赛",
            "subtitle": "拿到国赛银牌哈哈哈",
            "color": "#3f79d8",
            "hollow": true
          },
          {
            "id": "time-1782563332675",
            "time": "2023.9",
            "title": "第一次参加技能大赛",
            "subtitle": "数字化产品设计与开发，也是第一次让我在技能上找到自信",
            "color": "#3f79d8",
            "hollow": true
          }
        ]
      },
      "style": {
        "width": 330,
        "height": 545
      }
    },
    {
      "id": "node-businesscard-1782568979177",
      "type": "mine",
      "position": {
        "x": -68.60905670155026,
        "y": 480.2837657024479
      },
      "data": {
        "kind": "businesscard",
        "title": "名片卡",
        "accent": "#002FA7",
        "width": 280,
        "height": 166,
        "name": "开发者",
        "intro": "项目与开发记录",
        "tags": [
          "INTJ",
          "Flutter",
          "客户端"
        ],
        "avatarSrc": "/canvas/justin-avatar.jpg",
        "avatarFileName": "justin-avatar.jpg"
      },
      "style": {
        "width": 280,
        "height": 166
      }
    },
    {
      "id": "node-quote-1782594210516",
      "type": "mine",
      "position": {
        "x": 20.392503038078416,
        "y": 706.3344902411769
      },
      "data": {
        "kind": "quote",
        "title": "新引用卡",
        "contentHtml": "<p>发生的一切都是必然的</p>",
        "author": "巴鲁赫·斯宾诺莎",
        "accent": "#3f79d8",
        "width": 270,
        "height": 132
      },
      "style": {
        "width": 270,
        "height": 132
      }
    }
  ],
  "edges": [
    {
      "type": "mineCurve",
      "style": {
        "stroke": "#aebbd2",
        "strokeDasharray": "5 8",
        "strokeWidth": 1.6
      },
      "data": {},
      "source": "node-businesscard-1782568979177",
      "sourceHandle": "right",
      "target": "node-monitor-1782561306641",
      "targetHandle": "left",
      "id": "edge-node-businesscard-1782568979177-node-monitor-1782561306641-1782570216914"
    },
    {
      "type": "mineCurve",
      "style": {
        "stroke": "#aebbd2",
        "strokeDasharray": "5 8",
        "strokeWidth": 1.6
      },
      "data": {},
      "source": "node-businesscard-1782568979177",
      "sourceHandle": "right",
      "target": "node-timeline-1782563332675",
      "targetHandle": "left",
      "id": "edge-node-businesscard-1782568979177-node-timeline-1782563332675-1782570221974"
    }
  ]
};
