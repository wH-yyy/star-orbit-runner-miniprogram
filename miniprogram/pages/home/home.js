// pages/home/home.js
const userHelper = require('../utils/userInfoHelper');

Page({
  data: {
    userInfo : {},
    stats: [
      {
        value: '0 次',
        label: '打卡记录'
      },
      {
        value: '0 km',
        label: '累计里程'
      },
      {
        value: '0 min',
        label: '运动时长'
      }
    ],
    menuItems: [
      {
        id: 'edit',
        name: '个人信息',
        icon: ''
      },
      {
        id: 'awards',
        name: '我的奖项',
        icon: ''
      },
      {
        id: 'help',
        name: '帮助与反馈',
        icon: ''
      },
      {
        id: 'logout',
        name: '退出登录',
        icon: ''
      }
    ]
  },

  onLoad() {
    this.loadUserInfo()
  },

  /**
   * 页面显示时重新加载数据
   */
  onShow() {
    console.log('=== Home页面显示，重新加载用户信息 ===')
    this.loadUserInfo()
  },

  onPullDownRefresh() {
    userInfoHelper.refreshUserInfo()
    this.loadUserInfo()
    wx.stopPullDownRefresh()
  },

  loadUserInfo() {
    try {
      const app = getApp()
      const userInfo = app.globalData.userInfo
      const openid = userInfo?.openid
      
      if (!openid) {
        console.error('加载用户信息失败：openid不存在')
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/phone-login/phone-login'
          })
        }, 1500)
        return
      }
      
      // 从RunningRecords表中获取统计数据
      this.calculateRunningStats(openid, userInfo)
    } catch (error) {
      console.error('加载用户信息失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 计算跑步统计数据
   */
  calculateRunningStats(openid, userData) {
    console.log('=== Home页面开始计算跑步统计数据 ===')
    console.log('传入的openid:', openid)
    console.log('用户数据:', userData)
    
    const db = wx.cloud.database()
    console.log('Home页面准备查询RunningRecords表，条件:', { openid: openid })
    db.collection('RunningRecords')
      .where({
        openid: openid
      })
      .get()
      .then(res => {
        console.log('=== Home页面计算跑步统计数据 ===')
        console.log('查询结果:', res)
        console.log('查询到的记录数量:', res.data.length)
        console.log('查询到的记录详情:', res.data)
        
        let totalCount = 0
        let totalDistance = 0
        let totalDuration = 0

        // 遍历所有记录，只计算通过状态的记录
        res.data.forEach(item => {
          console.log('Home页面处理记录:', item)
          
          // 判断状态是否为通过（支持数字1和字符串'1'，统一转换为数字进行比较）
          const statusNum = parseInt(item.status)
          const isPassed = statusNum === 1
          console.log('Home页面记录状态:', item.status, '转换后:', statusNum, '是否通过:', isPassed)
          
          if (isPassed) {
            totalCount++
            
            // 计算总距离（确保是数字类型）
            if (item.running_distance) {
              const distance = parseFloat(item.running_distance) || 0
              console.log('Home页面距离:', distance)
              totalDistance += distance
            }
            
            // 计算总时长（将时间格式转换为秒）
            if (item.running_duration) {
              const durationInSeconds = this.convertDurationToSeconds(item.running_duration)
              console.log('Home页面时长（秒）:', durationInSeconds)
              totalDuration += durationInSeconds
            }
          }
        })

        console.log('=== Home页面统计结果 ===')
        console.log('总次数:', totalCount)
        console.log('总距离:', totalDistance)
        console.log('总时长:', totalDuration)

        // 计算总时长（分钟）
        const totalDurationMinutes = Math.round(totalDuration / 60)
        
        // 计算总距离（保留两位小数）
        const totalDistanceKm = totalDistance.toFixed(2)

        // 更新页面数据
        this.setData({
          userInfo: {
            ...userData,
            totalCount: totalCount,
            totalDistance: totalDistance,
            totalDuration: totalDuration
          },
          stats: [
            {
              value: totalCount + ' 次',
              label: '打卡记录'
            },
            {
              value: totalDistanceKm + ' km',
              label: '累计里程'
            },
            {
              value: totalDurationMinutes + ' min',
              label: '运动时长'
            }
          ]
        })
        
        console.log('Home页面设置后的数据:', this.data)
      })
      .catch(error => {
        console.error('计算跑步统计数据失败:', error)
        // 如果获取统计数据失败，使用默认值
        this.setData({
          userInfo: {
            ...userData,
            totalCount: 0,
            totalDistance: 0,
            totalDuration: 0
          },
          stats: [
            {
              value: '0 次',
              label: '打卡记录'
            },
            {
              value: '0.00 km',
              label: '累计里程'
            },
            {
              value: '0 min',
              label: '运动时长'
            }
          ]
        })
      })
  },

  /**
   * 将时间格式转换为秒
   */
  convertDurationToSeconds(duration) {
    if (!duration) return 0
    
    // 处理 HH:MM:SS 格式
    const parts = duration.split(':')
    if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0
      const minutes = parseInt(parts[1]) || 0
      const seconds = parseInt(parts[2]) || 0
      return hours * 3600 + minutes * 60 + seconds
    }
    // 处理 MM:SS 格式
    else if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0
      const seconds = parseInt(parts[1]) || 0
      return minutes * 60 + seconds
    }
    return 0
  },

  navigateToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    })
  },

  navigateToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  navigateToAwards() {
    wx.navigateTo({
      url: '/pages/awards/awards'
    })
  },

  handleLogout() {
    console.log('=== 开始退出登录 ===')
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        console.log('退出登录确认结果:', res)
        if (res.confirm) {
          console.log('用户确认退出登录')
          
          // 清除本地存储
          console.log('清除本地存储前的userInfo:', wx.getStorageSync('userInfo'))
          wx.clearStorageSync()
          console.log('清除本地存储后的userInfo:', wx.getStorageSync('userInfo'))
          
          // 重置全局数据
          const app = getApp()
          console.log('重置前的全局数据:', app.globalData)
          if (app.globalData) {
            app.globalData.userInfo = null
            app.globalData.hasLogin = false
          }
          console.log('重置后的全局数据:', app.globalData)
          
          // 显示退出成功提示
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 500
          })
          
          // 立即跳转到手机号一键登录页面
          console.log('准备跳转到手机号一键登录页面')
          setTimeout(() => {
            console.log('执行跳转到手机号一键登录页面')
            wx.redirectTo({
              url: '/pages/phone-login/phone-login',
              success: function(res) {
                console.log('跳转到手机号登录页面成功:', res)
              },
              fail: function(res) {
                console.error('跳转到手机号登录页面失败:', res)
                // 如果redirectTo失败，尝试使用navigateTo
                wx.navigateTo({
                  url: '/pages/phone-login/phone-login',
                  success: function(res) {
                    console.log('使用navigateTo跳转到手机号登录页面成功:', res)
                  },
                  fail: function(res) {
                    console.error('使用navigateTo跳转到手机号登录页面也失败:', res)
                  }
                })
              }
            })
          }, 500)
        }
      }
    })
  },

  /**
   * 菜单点击事件
   */
  handleMenuClick(e) {
    const id = e.currentTarget.dataset.id;
    switch(id) {
      case 'edit':
        // 跳转到编辑个人信息页面
        this.navigateToUserInfo();
        break;
      case 'awards':
        // 跳转到我的奖项页面
        this.navigateToAwards();
        break;
      case 'help':
        // 跳转到帮助与反馈页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
        break;
      case 'logout':
        // 退出登录逻辑
        this.handleLogout();
        break;
      default:
        break;
    }
  }
})