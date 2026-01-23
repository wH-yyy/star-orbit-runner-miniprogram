// pages/home/home.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      avatar: '/images/avatar.png',
      name: '加载中...',
      stu_id: '',           // 规范为stu_id
      campus: '',           // 校区
      college: '',          // 书院
      class_name: ''        // 规范为class_name
    },
    // 统计数据
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
        value: '0 天',
        label: '连续打卡'
      }
    ],
    // 菜单选项
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

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载用户信息（以防从编辑页面返回）
    this.loadUserInfo()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadUserInfo()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      // 从全局数据或本地存储获取用户学号
      const app = getApp()
      const stuId = app.globalData.userInfo?.stu_id || wx.getStorageSync('stu_id')
      
      console.log('=== Home页面加载用户信息 ===')
      console.log('获取到的stu_id:', stuId)
      
      if (!stuId) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }, 1500)
        return
      }
      
      // 从数据库获取用户信息
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          stu_id: stuId
        })
        .get()
      
      console.log('数据库查询结果:', res)
      
      if (res.data.length > 0) {
        const userData = res.data[0]
        console.log('用户数据:', userData)
        
        // 计算统计数据
        const totalDist = userData.totalDistance || 0
        const totalDur = userData.totalDuration || 0
        const totalCount = userData.totalCount || 0
        const totalDistanceKm = (totalDist / 1000).toFixed(2)
        const totalDurationMinutes = Math.round(totalDur / 60)
        
        console.log('统计数据:', { totalCount, totalDistanceKm, totalDurationMinutes })
        
        this.setData({
          userInfo: {
            avatar: userData.avatar || '/images/avatar.png',
            name: userData.name,
            stu_id: userData.stu_id,
            campus: userData.campus,
            college: userData.college,
            class_name: userData.class_name
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
              value: '0 天',
              label: '连续打卡'
            }
          ]
        })
        
        console.log('设置后的userInfo:', this.data.userInfo)
        console.log('设置后的stats:', this.data.stats)
        
        // 更新全局用户信息
        if (app.globalData) {
          app.globalData.userInfo = {
            _id: userData._id,
            stu_id: userData.stu_id,
            name: userData.name,
            gender: userData.gender,
            campus: userData.campus,
            class_name: userData.class_name,
            college: userData.college,
            phone: userData.phone,
            avatar: userData.avatar || '',
            totalCount: userData.totalCount || 0,
            totalDuration: userData.totalDuration || 0,
            totalDistance: userData.totalDistance || 0
          }
        }
      } else {
        console.error('未找到用户数据')
        wx.showToast({
          title: '用户信息不存在',
          icon: 'none'
        })
      }
      
    } catch (error) {
      console.error('加载用户信息失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 跳转到编辑个人信息页面
   */
  navigateToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    })
  },

  /**
   * 跳转到记录页面
   */
  navigateToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.clearStorageSync()
          
          // 清除全局数据
          const app = getApp()
          if (app.globalData) {
            app.globalData.userInfo = null
          }
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          
          // 跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            })
          }, 1500)
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
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
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