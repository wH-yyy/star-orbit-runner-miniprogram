// cloud/functions/checkSubmission/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 获取北京时间 YYYY-MM-DD
function getTodayDateStr() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000)
  return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')}`
}

// 计算两点之间的距离（单位：米）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径，单位：米
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

// 检查位置是否在允许范围内
function checkLocationValidity(userLat, userLon, userCampus) {
  try {
    // 根据用户校区获取对应的打卡目标位置
    let targetLat1, targetLon1, targetLat2, targetLon2, campusName, limitedDistance;
    limitedDistance = parseFloat(process.env.DISTANCE);
    
    if (userCampus === '兴庆校区') {
      targetLat1 = parseFloat(process.env.XQ_LATITUDE);
      targetLon1 = parseFloat(process.env.XQ_LONGITUDE);
      campusName = '兴庆校区';
    } else if (userCampus === '雁塔校区') {
      // 雁塔校区支持两个打卡点
      targetLat1 = parseFloat(process.env.YT_LATITUDE1);
      targetLon1 = parseFloat(process.env.YT_LONGITUDE1);
      targetLat2 = parseFloat(process.env.YT_LATITUDE2);
      targetLon2 = parseFloat(process.env.YT_LONGITUDE2);
      campusName = '雁塔校区';
    } else {
      // 未知校区，跳过位置校验
      console.log(`未知校区：${userCampus}，跳过位置校验`);
      return { isValid: true, message: '' };
    }
    
    // 兴庆校区检查
    if (userCampus === '兴庆校区') {
      if (!targetLat1 || !targetLon1) {
        console.log(`未配置${campusName}打卡目标位置，跳过位置校验`);
        return { isValid: true, message: '' };
      }
      
      if (!userLat || !userLon) {
        return { 
          isValid: false, 
          message: '未获取到定位信息，请开启定位权限' 
        };
      }
      
      // 计算距离
      const distance = calculateDistance(userLat, userLon, targetLat1, targetLon1);
      console.log(`当前位置距离${campusName}打卡点：${distance.toFixed(2)}米`);
      
      if (distance > limitedDistance) {
        return { 
          isValid: false, 
          message: `未在${campusName}打卡指定范围内` 
        };
      }
      
      return { 
        isValid: true, 
        message: `${campusName}位置校验通过`,
        distance: distance,
        campus: campusName
      };
    }
    
    // 雁塔校区检查（支持两个打卡点）
    if (userCampus === '雁塔校区') {
      if ((!targetLat1 || !targetLon1) && (!targetLat2 || !targetLon2)) {
        console.log(`未配置${campusName}打卡目标位置，跳过位置校验`);
        return { isValid: true, message: '' };
      }
      
      if (!userLat || !userLon) {
        return { 
          isValid: false, 
          message: '未获取到定位信息，请开启定位权限' 
        };
      }
      
      let minDistance = Infinity;
      let validPoint = false;
      
      // 检查第一个打卡点
      if (targetLat1 && targetLon1) {
        const distance1 = calculateDistance(userLat, userLon, targetLat1, targetLon1);
        console.log(`当前位置距离${campusName}打卡点1：${distance1.toFixed(2)}米`);
        if (distance1 <= limitedDistance) {
          validPoint = true;
          minDistance = Math.min(minDistance, distance1);
        }
      }
      
      // 检查第二个打卡点
      if (targetLat2 && targetLon2) {
        const distance2 = calculateDistance(userLat, userLon, targetLat2, targetLon2);
        console.log(`当前位置距离${campusName}打卡点2：${distance2.toFixed(2)}米`);
        if (distance2 <= limitedDistance) {
          validPoint = true;
          minDistance = Math.min(minDistance, distance2);
        }
      }
      
      if (!validPoint) {
        return { 
          isValid: false, 
          message: `未在${campusName}打卡指定范围内` 
        };
      }
      
      return { 
        isValid: true, 
        message: `${campusName}位置校验通过`,
        distance: minDistance,
        campus: campusName
      };
    }
    
  } catch (error) {
    console.error('位置校验失败:', error);
    return { 
      isValid: false, 
      message: '位置校验失败，请重试' 
    };
  }
}

// 检查活动状态
async function checkActivityStatus(todayStr) {
  try {
    // 获取当前激活的活动配置
    const activityRes = await db.collection('activity_config')
      .where({
        status: 1
      })
      .get()

    if (!activityRes.data || activityRes.data.length === 0) {
      return {
        canSubmit: false,
        message: '当前没有激活的活动配置'
      }
    }

    const currentActivity = activityRes.data[0]
    const today = new Date(todayStr)
    const startDate = new Date(currentActivity.start_date)
    const endDate = new Date(currentActivity.end_date)
    
    // 检查活动是否在有效期内
    if (today < startDate) {
      return {
        canSubmit: false,
        message: `活动尚未开始`
      }
    }
    
    if (today > endDate) {
      return {
        canSubmit: false,
        message: `活动已结束`
      }
    }

    return {
      canSubmit: true,
      message: '活动状态正常'
    }

  } catch (error) {
    console.error('检查活动状态失败:', error)
    return {
      canSubmit: false,
      message: '活动状态检查失败'
    }
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取前端传递的定位信息
  const { coordinates } = event
  const userLat = coordinates?.latitude
  const userLon = coordinates?.longitude

  // 1. 从数据库获取用户信息（包括 status）
  const userRes = await db.collection('Users').where({ openid: openid }).get()
  const user = userRes.data[0]
  if (!user) {
    return { code: 404, message: '用户不存在' }
  }

  // 禁跑检查（status=1）
  if (user.status === 1) {
    return {
      code: 403,
      message: `您已被禁跑，剩余 ${user.ban_remaining_days || 0} 天`
    }
  }

  // 活动状态检查
  const todayStr = getTodayDateStr()
  const activityCheck = await checkActivityStatus(todayStr)
  if (!activityCheck.canSubmit) {
    return {
      code: 405,
      message: activityCheck.message
    }
  }

  // 停跑日检查
  const restRes = await db.collection('rest_days').where({ date: todayStr }).get()
  if (restRes.data.length > 0) {
    return {
      code: 402,
      message: `今日停跑，原因：${restRes.data[0].reason || '无'}`
    }
  }

  // 重复提交检查（今日已提交过记录）
  const recordRes = await db.collection('RunningRecords')
    .where({ openid, run_date: todayStr })
    .count()
  if (recordRes.total > 0) {
    return { code: 401, message: '今日已提交，请勿重复提交' }
  }

  // 位置校验检查（新增）
  const locationCheck = checkLocationValidity(userLat, userLon, user.campus)
  if (!locationCheck.isValid) {
    return {
      code: 406,
      message: locationCheck.message
    }
  }

  // 全部通过
  return { 
    code: 200, 
    message: '可以提交',
    data: {
      locationValid: locationCheck.isValid,
      distance: locationCheck.distance
    }
  }
}