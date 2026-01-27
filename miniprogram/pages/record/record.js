// pages/record/record.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      _id: '',
      avatar: '',
      campus: '',
      class_name: '',
      college: '',
      createdTime: '',
      gender: '',
      name: '',
      openid: '',
      password: '',
      phone: '',
      status: '',
      stu_id: '',
      updateTime: '',
    },
    // 跑步记录列表
    recordList: [],
    // 统计数据
    totalCount: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalDistanceKm: '0.00',
    totalDurationMinutes: '0',
    // 加载状态
    loading: true,
    // 是否有更多数据
    hasMore: true,
    // 分页参数
    page: 1,
    pageSize: 10
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo()
    this.loadRecords()
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const app = getApp()
    const openid = app.globalData.userInfo?.openid
    
    console.log('=== record.js loadUserInfo ===')
    console.log('全局userInfo:', app.globalData.userInfo)
    console.log('本地存储openid:', wx.getStorageSync('openid'))
    console.log('获取到的openid:', openid)
    
    if (!openid) {
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
    
    // 从数据库获取用户完整信息
    const db = wx.cloud.database()
    console.log('开始查询数据库Users表，条件:', { openid: openid })
    db.collection('Users')
      .where({
        openid: openid
      })
      .get()
      .then(res => {
        console.log('数据库查询结果:', res)
        
        if (res.data.length > 0) {
          const userData = res.data[0]
          console.log('找到用户数据，用户ID:', userData._id)
          console.log('用户完整数据:', userData)
          
          // 直接获取totalDistance字段，不使用默认值，以便查看真实数据
          const totalDist = userData.totalDistance
          const totalDur = userData.totalDuration
          const totalCnt = userData.totalCount
          
          console.log('从数据库获取的原始统计数据:', {
            totalCount: totalCnt,
            totalDistance: totalDist,
            totalDuration: totalDur,
            totalDistanceType: typeof totalDist,
            totalDistanceValue: totalDist
          })
          
          // 强制转换为数字类型，确保计算正确
          const numericTotalDist = parseFloat(totalDist) || 0
          const numericTotalDur = parseFloat(totalDur) || 0
          const numericTotalCnt = parseInt(totalCnt) || 0
          
          console.log('转换后的数字类型统计数据:', {
            totalCount: numericTotalCnt,
            totalDistance: numericTotalDist,
            totalDuration: numericTotalDur
          })
          
          // 直接使用原始值作为公里数，不再进行单位转换
          const distanceKm = numericTotalDist
          
          console.log('累计里程数计算:', {
            originalTotalDist: totalDist,
            numericTotalDist: numericTotalDist,
            calculatedDistanceKm: distanceKm,
            displayDistanceKm: distanceKm.toFixed(2)
          })
          
          // 从RunningRecords表中获取统计数据
          this.calculateRunningStats(openid, userData)
        } else {
          console.error('未找到用户数据，openid:', openid)
        }
      })
      .catch(error => {
        console.error('加载用户信息失败:', error)
      })
  },

  /**
   * 加载跑步记录
   */
  loadRecords(loadMore = false) {
    if (!loadMore) {
      this.setData({ loading: true, page: 1 })
    }
    
    const app = getApp()
    const openid = app.globalData.userInfo?.openid
    
    if (!openid) {
      return
    }
    
    // 从数据库获取跑步记录
    const db = wx.cloud.database()
    const skip = loadMore ? (this.data.page - 1) * this.data.pageSize : 0
    db.collection('RunningRecords')
      .where({
        openid: openid
      })
      .orderBy('create_time', 'desc')
      .skip(skip)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        // 确保status字段为数字类型，并处理未通过原因
        const processedData = res.data.map(item => {
          if (item.status !== undefined) {
            item.status = parseInt(item.status);
          }
          
          // 处理未通过原因显示
          if (item.audit_reason) {
            let reason = item.audit_reason.toLowerCase();
            if (reason.includes('ocr') || reason.includes('识别')) {
              item.displayAuditReason = '学号和姓名不匹配';
            } else {
              item.displayAuditReason = item.audit_reason;
            }
          } else {
            item.displayAuditReason = '未提供具体原因';
          }
          
          return item;
        });
        
        let newRecordList = []
        if (loadMore) {
          newRecordList = [...this.data.recordList, ...processedData]
        } else {
          newRecordList = processedData;
        }
        
        this.setData({
          recordList: newRecordList,
          hasMore: res.data.length === this.data.pageSize,
          loading: false
        })
      })
      .catch(error => {
        console.error('加载跑步记录失败:', error)
        this.setData({ loading: false })
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      })
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
    // 每次显示页面时重新加载数据（防止从提交页面返回后数据不更新）
    this.loadUserInfo()
    this.loadRecords()
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
    // 下拉刷新数据
    this.loadUserInfo()
    this.loadRecords()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 上拉加载更多
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreData();
    }
  },
  
  /**
   * 跳转到提交页面
   */
  goToSubmit() {
    wx.navigateTo({
      url: '/pages/submit/submit'
    })
  },
  
  /**
   * 预览图片
   */
  previewImage(e) {
    const images = e.currentTarget.dataset.images
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      urls: images,
      current: images[index]
    })
  },
  
  /**
   * 加载更多数据
   */
  loadMoreData() {
    if (this.data.loading || !this.data.hasMore) {
      return
    }
    
    this.setData({ loading: true })
    this.data.page++
    this.loadRecords(true)
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 查看记录详情
   */
  viewRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?id=${id}`
    });
  },

  /**
   * 计算跑步统计数据
   */
  calculateRunningStats(openid, userData) {
    console.log('=== Record页面开始计算跑步统计数据 ===')
    console.log('传入的openid:', openid)
    console.log('用户数据:', userData)
    
    const db = wx.cloud.database()
    console.log('Record页面准备查询RunningRecords表，条件:', { openid: openid })
    db.collection('RunningRecords')
      .where({
        openid: openid
      })
      .get()
      .then(res => {
        console.log('=== Record页面计算跑步统计数据 ===')
        console.log('查询结果:', res)
        console.log('查询到的记录数量:', res.data.length)
        console.log('查询到的记录详情:', res.data)
        
        let totalCount = 0
        let totalDistance = 0
        let totalDuration = 0

        // 遍历所有记录，只计算通过状态的记录
        res.data.forEach(item => {
          console.log('Record页面处理记录:', item)
          
          // 判断状态是否为通过（支持数字1和字符串'1'）
          const isPassed = item.status === 1 || item.status === '1'
          console.log('Record页面记录状态:', item.status, '是否通过:', isPassed)
          
          if (isPassed) {
            totalCount++
            
            // 计算总距离（确保是数字类型）
            if (item.running_distance) {
              const distance = parseFloat(item.running_distance) || 0
              console.log('Record页面距离:', distance)
              totalDistance += distance
            }
            
            // 计算总时长（将时间格式转换为秒）
            if (item.running_duration) {
              const durationInSeconds = this.convertDurationToSeconds(item.running_duration)
              console.log('Record页面时长（秒）:', durationInSeconds)
              totalDuration += durationInSeconds
            }
          }
        })

        console.log('=== Record页面统计结果 ===')
        console.log('总次数:', totalCount)
        console.log('总距离:', totalDistance)
        console.log('总时长:', totalDuration)

        this.setData({
          userInfo: {
            _id: userData._id,
            avatar: userData.avatar || '/images/avatar.png',
            campus: userData.campus,
            class_name: userData.class_name,
            college: userData.college,
            createdTime: userData.createdTime,
            gender: userData.gender,
            name: userData.name,
            openid: userData.openid,
            password: userData.password,
            phone: userData.phone,
            status: userData.status,
            stu_id: userData.stu_id,
            updateTime: userData.updateTime 
          },
          totalCount: totalCount,
          totalDistance: totalDistance,
          totalDuration: totalDuration,
          totalDistanceKm: totalDistance.toFixed(2),
          totalDurationMinutes: Math.round(totalDuration / 60).toString()
        })
        
        console.log('Record页面设置后的数据:', this.data)
      })
      .catch(error => {
        console.error('计算跑步统计数据失败:', error)
        // 如果获取统计数据失败，使用默认值
        this.setData({
          userInfo: {
            _id: userData._id,
            avatar: userData.avatar || '/images/avatar.png',
            campus: userData.campus,
            class_name: userData.class_name,
            college: userData.college,
            createdTime: userData.createdTime,
            gender: userData.gender,
            name: userData.name,
            openid: userData.openid,
            password: userData.password,
            phone: userData.phone,
            status: userData.status,
            stu_id: userData.stu_id,
            updateTime: userData.updateTime 
          },
          totalCount: 0,
          totalDistance: 0,
          totalDuration: 0,
          totalDistanceKm: '0.00',
          totalDurationMinutes: '0'
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
  }

})