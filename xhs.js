/**
 * @author fmz200, Baby, wooyooge
 * @function 小红书去广告、净化、解除下载限制、画质增强等
 * @date 2026-01-29
 * @quote @RuCu6
 * @supported Loon
 */

// Loon 原生 API 兼容层（无需外部 Env 依赖）
const $ = {
  setdata(val, key) { return $persistentStore.write(val, key); },
  getdata(key) { return $persistentStore.read(key); },
  msg(title, subtitle, body) { $notification.post(title, subtitle, body); }
};

!(function () {
const url = $request.url;
const rsp_body = $response.body;
if (!rsp_body) {
  return $done({});
}
let obj = JSON.parse(rsp_body);

if (url.includes("/search/banner_list")) {
  obj.data = {};
} 

if (url.includes("/search/hot_list")) {
  // 热搜列表
  obj.data.items = [];
}

if (url.includes("/search/hint")) {
  // 搜索栏填充词
  obj.data.hint_words = [];
}

if (url.includes("/search/trending?")) {
  // 搜索栏
  obj.data.queries = [];
  obj.data.hint_word = {};
}

if (url.includes("/search/notes?")) {
  // 搜索结果
  if (obj.data.items?.length > 0) {
    obj.data.items = obj.data.items.filter((i) => i.model_type === "note");
  }
}

if (url.includes("/system_service/config?")) {
  // 整体配置
  const item = ["app_theme", "loading_img", "splash", "store"];
  if (obj.data) {
    for (let i of item) {
      delete obj.data[i];
    }
  }
}

if (url.includes("/system_service/splash_config")) {
  // 开屏广告
  if (obj?.data?.ads_groups?.length > 0) {
    for (let i of obj.data.ads_groups) {
      i.start_time = 3818332800; // Unix 时间戳 2090-12-31 00:00:00
      i.end_time = 3818419199; // Unix 时间戳 2090-12-31 23:59:59
      if (i?.ads?.length > 0) {
        for (let ii of i.ads) {
          ii.start_time = 3818332800; // Unix 时间戳 2090-12-31 00:00:00
          ii.end_time = 3818419199; // Unix 时间戳 2090-12-31 23:59:59
        }
      }
    }
  }
}

if (url.includes("/note/imagefeed?") || url.includes("/note/feed?")) {
  console.log('打印原body：' + JSON.stringify(obj));
  // 信息流 图片
  if (obj?.data?.length > 0) {
    if (obj.data[0]?.note_list?.length > 0) {
      for (let item of obj.data[0].note_list) {
        if (item?.media_save_config) {
          // 水印开关
          item.media_save_config.disable_save = false;
          item.media_save_config.disable_watermark = true;
          item.media_save_config.disable_weibo_cover = true;
        }
        if (item?.share_info?.function_entries?.length > 0) {
          // 下载限制
          const addItem = {type: "video_download"};
          let func = item.share_info.function_entries[0];
          if (func?.type !== "video_download") {
            // 向数组开头添加对象
            item.share_info.function_entries.unshift(addItem);
          }
        }
        // 新版下载限制
        if (Array.isArray(item.function_switch)) {
          item.function_switch.forEach(item => {
            if (item?.type === 'image_download') {
              item.enable = true;
            }
          });
        }
        // 复制权限
        const options = item.note_text_press_options;
        if (Array.isArray(options)) {
          const hasCopy = options.some(item => item.key === 'copy');
          if (!hasCopy) {
            options.push({
              key: 'copy',
              extra: ''
            });
          }
        }

        // 处理帖子引用的标签
        if (item.hash_tag) {
          item.hash_tag = item.hash_tag.filter(tag => tag.type !== "interact_vote");
        }
      }

      const images_list = obj.data[0].note_list[0].images_list;
      // 画质增强
      obj.data[0].note_list[0].images_list = imageEnhance(JSON.stringify(images_list));
      // 保存无水印信息
      $.setdata(JSON.stringify(images_list), "fmz200.xiaohongshu.feed.rsp");
      console.log('已存储无水印信息♻️');
    }
  }
} 

if (url.includes("/note/live_photo/save")) {
  console.log('原body：' + rsp_body);
  const rsp = $.getdata("fmz200.xiaohongshu.feed.rsp");
  console.log("读取缓存key[fmz200.xiaohongshu.feed.rsp]的值：" + rsp);
  // console.log("读取缓存val：" + rsp);
  if (rsp == null || rsp.length === 0) {
    console.log('缓存无内容，返回原body');
    $done({body: rsp_body});
  }
  const cache_body = JSON.parse(rsp);
  let new_data = [];
  for (const images of cache_body) {
    if (images.live_photo_file_id) {
      const item = {
        file_id: images.live_photo_file_id,
        video_id: images.live_photo.media.video_id,
        url: images.live_photo.media.stream.h265[0].master_url
      };
      new_data.push(item);
    }
  }
  if (obj.data.datas) {
    replaceUrlContent(obj.data.datas, new_data);
  } else {
    obj = {"code": 0, "success": true, "msg": "成功", "data": {"datas": new_data}};
  }
  console.log('新body：' + JSON.stringify(obj));
} 

if (url.includes("/note/widgets")) {
  const item = ["cooperate_binds", "generic", "note_next_step", "widget_list"];
  if (obj?.data) {
    for (let i of item) {
      delete obj.data[i];
    }
  }
} 

if (url.includes("/v3/note/videofeed?")) {
  // 信息流 视频
  if (obj?.data?.length > 0) {
    for (let item of obj.data) {
      if (item?.media_save_config) {
        // 水印
        item.media_save_config.disable_save = false;
        item.media_save_config.disable_watermark = true;
        item.media_save_config.disable_weibo_cover = true;
      }
      if (item?.share_info?.function_entries?.length > 0) {
        // 下载限制
        const addItem = {type: "video_download"};
        let func = item.share_info.function_entries[0];
        if (func?.type !== "video_download") {
          // 向数组开头添加对象
          item.share_info.function_entries.unshift(addItem);
        }
      }
    }
  }
}

// 信息流 视频
if (url.includes("/v4/note/videofeed")) {
  let videoData = [];
  if (obj.data?.length > 0) {
    for (let item of obj.data) {
      // 强制开启权限
      if (item?.media_save_config) {
        item.media_save_config.disable_save = false;
        item.media_save_config.disable_watermark = true;
        item.media_save_config.disable_weibo_cover = true;
      }

      // 处理 function_switch (修复按钮置灰)
      if (item?.function_switch?.length > 0) {
        for (let switchItem of item.function_switch) {
          if (switchItem.type === "video_download") {
            switchItem.enable = true;
            if (switchItem.reason) delete switchItem.reason;
          }
        }
      }

      // 添加下载按钮（如果未存在）
      if (item?.share_info?.function_entries?.length > 0) {
        const hasDownload = item.share_info.function_entries.some(entry => entry.type === "video_download");
        if (!hasDownload) {
          console.log(`添加下载按钮: ${item.id}`);
          item.share_info.function_entries.push({type: "video_download"});
        }
      }

      // 提取最佳视频流 (修复逻辑：分辨率相同优先选码率高的)
      const h265List = item?.video_info_v2?.media?.stream?.h265 || [];
      const h264List = item?.video_info_v2?.media?.stream?.h264 || [];

      let selectedStream = null;

      // 排序函数：优先分辨率面积，其次平均码率
      const sortStream = (a, b) => {
        const resA = (a.width || 0) * (a.height || 0);
        const resB = (b.width || 0) * (b.height || 0);
        if (resB !== resA) return resB - resA; // 面积从大到小
        return (b.avg_bitrate || 0) - (a.avg_bitrate || 0); // 码率从大到小
      };

      if (Array.isArray(h265List) && h265List.length > 0) {
        // 过滤有效链接并排序
        const sorted = h265List.filter(v => !!v.master_url).sort(sortStream);
        if (sorted.length > 0) selectedStream = sorted[0];
      }

      // 降级策略：如果没有 H265，尝试 H264
      if (!selectedStream && Array.isArray(h264List) && h264List.length > 0) {
        const sorted = h264List.filter(v => !!v.master_url).sort(sortStream);
        if (sorted.length > 0) selectedStream = sorted[0];
      }

      // 存入缓存数组
      if (item?.id && selectedStream?.master_url) {
        const data = {
          id: item.id,
          url: selectedStream.master_url
        };
        console.log(`提取成功 ➜ ${item.id} → ${selectedStream.stream_desc}`);
        videoData.push(data);
        console.log(`[缓存] ID:${item.id} | 规格:${selectedStream.quality_type} | 码率:${selectedStream.avg_bitrate}`);
      } else {
        console.log(`未找到可用视频: ${item.id}`);
      }
    }
    // 写入本地持久化缓存
    $.setdata(JSON.stringify(videoData), "redBookVideoFeed");
    console.log(`已缓存普通视频 ${videoData.length} 条`);
  }
}

// 视频保存请求
if (url.includes("/v10/note/video/save")) {
  let videoFeed = JSON.parse($.getdata("redBookVideoFeed")); // 读取持久化存储
  if (obj.data?.note_id !== "" && videoFeed?.length > 0) {
    for (let item of videoFeed) {
      if (item.id === obj.data.note_id) {
        obj.data.download_url = item.url;
      }
    }
  }
  // 解除下载限制
  if (obj.data?.disable) {
    delete obj.data.disable;
    delete obj.data.msg;
    obj.data.status = 2;
  }
}

if (url.includes("/user/followings/followfeed")) {
  // 关注页信息流 可能感兴趣的人
  if (obj?.data?.items?.length > 0) {
    // 白名单
    obj.data.items = obj.data.items.filter((i) => i?.recommend_reason === "friend_post");
  }
} 

if (url.includes("/v4/followfeed")) {
  // 关注列表
  if (obj?.data?.items?.length > 0) {
    // recommend_user 可能感兴趣的人
    obj.data.items = obj.data.items.filter((i) => !["recommend_user"].includes(i.recommend_reason));
  }
}  

if (url.includes("/recommend/user/follow_recommend")) {
  // 用户详情页 你可能感兴趣的人
  if (obj?.data?.title === "你可能感兴趣的人" && obj?.data?.rec_users?.length > 0) {
    obj.data = {};
  }
} 

if (url.includes("/v6/homefeed")) {
  if (obj?.data?.length > 0) {
    // 信息流广告
    let newItems = [];
    for (let item of obj.data) {
      if (item?.model_type === "live_v2") {
        // 信息流-直播
      } else if (item?.hasOwnProperty("ads_info")) {
        // 信息流-赞助
      } else if (item?.hasOwnProperty("card_icon")) {
        // 信息流-带货
      } else if (item?.note_attributes?.includes("goods")) {
        // 信息流-商品
      } else {
        if (item?.related_ques) {
          delete item.related_ques;
        }
        newItems.push(item);
      }
    }
    obj.data = newItems;
  }
}

// 加载评论区
if (url.includes("/api/sns/v5/note/comment/list?") || url.includes("/api/sns/v3/note/comment/sub_comments?")) {
  replaceRedIdWithFmz200(obj.data);
  let livePhotos = [];
  let note_id = "";
  if (obj.data?.comments?.length > 0) {
    note_id = obj.data.comments[0].note_id;
    for (const comment of obj.data.comments) {
      // comment_type: 0-文字，2-图片/live，3-表情包
      if (comment.comment_type === 3) {
        comment.comment_type = 2;
        console.log(`修改评论类型：3->2`);
      }
      if (comment.media_source_type === 1) {
        comment.media_source_type = 0;
        console.log(`修改媒体类型：1->0`);
      }
      if (comment.pictures?.length > 0) {
        console.log("comment_id: " + comment.id);
        for (const picture of comment.pictures) {
          if (picture.video_id) {
            const picObj = JSON.parse(picture.video_info);
            if (picObj.stream?.h265?.[0]?.master_url) {
              console.log("video_id：" + picture.video_id);
              const videoData = {
                videId: picture.video_id,
                videoUrl: picObj.stream.h265[0].master_url
              };
              livePhotos.push(videoData);
            }
          }
        }
      }
      if (comment.sub_comments?.length > 0) {
        for (const sub_comment of comment.sub_comments) {
          if (sub_comment.comment_type === 3) {
            sub_comment.comment_type = 2;
            console.log(`修改评论类型1：3->2`);
          }
          if (sub_comment.media_source_type === 1) {
            sub_comment.media_source_type = 0;
            console.log(`修改媒体类型1：1->0`);
          }
          if (sub_comment.pictures?.length > 0) {
            console.log("comment_id1: " + comment.id);
            for (const picture of sub_comment.pictures) {
              if (picture.video_id) {
                const picObj = JSON.parse(picture.video_info);
                if (picObj.stream?.h265?.[0]?.master_url) {
                  console.log("video_id1：" + picture.video_id);
                  const videoData = {
                    videId: picture.video_id,
                    videoUrl: picObj.stream.h265[0].master_url
                  };
                  livePhotos.push(videoData);
                }
              }
            }
          }
        }
      }
    }
  }
  console.log("本次note_id：" + note_id);
  if (livePhotos.length > 0) {
    let commitsRsp;
    const commitsCache = $.getdata("fmz200.xiaohongshu.comments.rsp");
    console.log("读取缓存val：" + commitsCache);
    if (!commitsCache) {
      commitsRsp = {noteId: note_id, livePhotos: livePhotos};
    } else {
      commitsRsp = JSON.parse(commitsCache);
      console.log("缓存note_id：" + commitsRsp.noteId);
      if (commitsRsp.noteId === note_id) {
        console.log("增量数据");
        commitsRsp.livePhotos = deduplicateLivePhotos(commitsRsp.livePhotos.concat(livePhotos));
      } else {
        console.log("更换数据");
        commitsRsp = {noteId: note_id, livePhotos: livePhotos};
      }
    }
    console.log("写入缓存val：" + JSON.stringify(commitsRsp));
    $.setdata(JSON.stringify(commitsRsp), "fmz200.xiaohongshu.comments.rsp");
  }
}

// 下载评论区live图
if (url.includes("/api/sns/v1/interaction/comment/video/download?")) {
  const commitsCache = $.getdata("fmz200.xiaohongshu.comments.rsp");
  console.log("读取缓存val：" + commitsCache);
  console.log("目标video_id：" + obj.data.video.video_id);
  if (commitsCache) {
    let commitsRsp = JSON.parse(commitsCache);
    if (commitsRsp.livePhotos.length > 0 && obj.data?.video) {
      for (const item of commitsRsp.livePhotos) {
        // console.log("缓存video_id：" + item.videId);
        if (item.videId === obj.data.video.video_id) {
          console.log("匹配到无水印链接：" + item.videoUrl);
          obj.data.video.video_url = item.videoUrl;
          break;
        }
      }
    }
  } else {
    console.log(`没有[${obj.data?.video.video_id}]的无水印地址`);
  }
}

$done({body: JSON.stringify(obj)});
})();

// 小红书画质增强：加载2K分辨率的图片
function imageEnhance(jsonStr) {
  if (!jsonStr) {
    console.error("jsonStr is undefined or null");
    return [];
  }

  const imageQuality = $.getdata("fmz200.xiaohongshu.imageQuality");
  console.log(`Image Quality: ${imageQuality}`);
  if (imageQuality === "original") { // 原始分辨率，PNG格式的图片，占用空间比较大
    console.log("画质设置为-原始分辨率");
    jsonStr = jsonStr.replace(/\?imageView2\/2[^&]*(?:&redImage\/frame\/0)/, "?imageView2/0/format/png&redImage/frame/0");
  } else { // 高像素输出
    console.log("画质设置为-高像素输出");
    const regex1 = /imageView2\/2\/w\/\d+\/format/g;
    jsonStr = jsonStr.replace(regex1, `imageView2/2/w/2160/format`);

    const regex2 = /imageView2\/2\/h\/\d+\/format/g;
    jsonStr = jsonStr.replace(regex2, `imageView2/2/h/2160/format`);
  }
  console.log('图片画质增强完成✅');

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON parsing error: ", e);
    return [];
  }
}

function replaceUrlContent(collectionA, collectionB) {
  console.log('替换无水印的URL');
  collectionA.forEach(itemA => {
    const itemB = collectionB.find(itemB => itemB.file_id === itemA.file_id);
    if (itemB) {
      itemA.url = itemA.url !== "" ? itemA.url.replace(/^https?:\/\/.*\.mp4(\?[^"]*)?/g, `${itemB.url.match(/(.*)\.mp4/)[1]}.mp4`) : itemB.url;
      itemA.author = "@fmz200"
    }
  });
}

function deduplicateLivePhotos(livePhotos) {
  const seen = new Map();
  livePhotos = livePhotos.filter(item => {
    if (seen.has(item.videId)) {
      return false;
    }
    seen.set(item.videId, true);
    return true;
  });
  return livePhotos;
}

function replaceRedIdWithFmz200(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(item => replaceRedIdWithFmz200(item));
  } else if (typeof obj === 'object' && obj !== null) {
    if ('red_id' in obj) {
      obj.fmz200 = obj.red_id; // 创建新属性fmz200
      delete obj.red_id; // 删除旧属性red_id
    }
    Object.keys(obj).forEach(key => {
      replaceRedIdWithFmz200(obj[key]);
    });
  }
}
